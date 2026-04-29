use anyhow::{Context, Result};
use rusqlite::{Connection, OpenFlags};
use std::collections::HashMap;
use std::path::Path;

use crate::schema::article::{Article, ArticleContentItem, ArticleId};
use crate::schema::files::{DirectoryFiles, DirectoryFilesItem, DirectoryFilesItemSizes, ImageSize};
use crate::schema::manifest::{
    Manifest, ManifestArticlesItem, ManifestArticlesItemCategoryIdsItem,
    ManifestArticlesItemId, ManifestArticlesItemStatus, ManifestBlog, ManifestCategoriesItem,
    ManifestCategoriesItemId, ManifestDirectoriesItem, ManifestMapMemosItem,
};

pub struct BlogData {
    pub manifest: Manifest,
    pub articles: HashMap<String, Article>,
    pub files: HashMap<String, DirectoryFiles>,
}

pub fn load_blog_data(db_path: &Path) -> Result<BlogData> {
    let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .with_context(|| format!("cannot open {}", db_path.display()))?;

    // ── blog_config ───────────────────────────────────────────────────────
    let (blog_name, top_image_uuid): (String, Option<String>) = conn
        .query_row(
            "SELECT bc.name, i.uuid FROM blog_config bc
             LEFT JOIN images i ON i.id = bc.top_image_id
             WHERE bc.id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .context("blog_config not found")?;

    let blog = ManifestBlog {
        name: blog_name,
        top_image_id: top_image_uuid.as_deref().and_then(|s| s.parse().ok()),
    };

    // ── categories ────────────────────────────────────────────────────────
    let categories: Vec<ManifestCategoriesItem> = {
        let mut stmt = conn.prepare(
            "SELECT slug, name, priority FROM categories ORDER BY priority",
        )?;
        let x = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .map(|(slug, name, priority)| ManifestCategoriesItem {
            id: ManifestCategoriesItemId::try_from(slug.as_str())
                .unwrap_or_else(|_| ManifestCategoriesItemId::try_from("unknown").unwrap()),
            name,
            priority,
        })
        .collect();
        x
    };

    // ── directories ───────────────────────────────────────────────────────
    // build ロジックでは不使用だが型として必要
    let directories: Vec<ManifestDirectoriesItem> = {
        let mut stmt =
            conn.prepare("SELECT id, name, created_at FROM directories")?;
        let x = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .map(|(id, name, created_at)| ManifestDirectoriesItem {
            id: uuid::Uuid::from_u128(id as u128),
            name,
            created_at,
        })
        .collect();
        x
    };

    // ── images → files (FilesIndex 用) ────────────────────────────────────
    // build_file_index は files.values() のみ使用するため、HashMap のキーは問わない
    struct ImageRow {
        dir_id: i64,
        uuid: String,
        name: String,
        small_w: Option<i64>,
        small_h: Option<i64>,
        med_w: Option<i64>,
        med_h: Option<i64>,
        orig_w: i64,
        orig_h: i64,
        shooting_datetime: Option<i64>,
    }
    let image_rows: Vec<ImageRow> = {
        let mut stmt = conn.prepare(
            "SELECT directory_id, uuid, name,
                    small_width, small_height,
                    medium_width, medium_height,
                    original_width, original_height,
                    shooting_datetime
             FROM images",
        )?;
        let x = stmt.query_map([], |row| {
            Ok(ImageRow {
                dir_id: row.get(0)?,
                uuid: row.get(1)?,
                name: row.get(2)?,
                small_w: row.get(3)?,
                small_h: row.get(4)?,
                med_w: row.get(5)?,
                med_h: row.get(6)?,
                orig_w: row.get(7)?,
                orig_h: row.get(8)?,
                shooting_datetime: row.get(9)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        x
    };

    let mut files_by_dir: HashMap<String, Vec<DirectoryFilesItem>> = HashMap::new();
    for r in image_rows {
        let item = DirectoryFilesItem {
            id: r.uuid.parse().unwrap_or(uuid::Uuid::nil()),
            kind: "image".to_string(),
            name: r.name,
            shooting_datetime: r.shooting_datetime,
            sizes: DirectoryFilesItemSizes {
                small: r.small_w.zip(r.small_h).map(|(w, h)| ImageSize { width: w, height: h }),
                medium: r.med_w.zip(r.med_h).map(|(w, h)| ImageSize { width: w, height: h }),
                original: ImageSize { width: r.orig_w, height: r.orig_h },
            },
        };
        files_by_dir
            .entry(r.dir_id.to_string())
            .or_default()
            .push(item);
    }
    let files: HashMap<String, DirectoryFiles> = files_by_dir
        .into_iter()
        .map(|(k, v)| (k, DirectoryFiles(v)))
        .collect();

    // ── articles (manifest サマリー + content) ────────────────────────────
    struct ArticleMetaRow {
        pk: i64,
        slug: String,
        title: String,
        status: String,
        thumb_uuid: Option<String>,
        gpx_filename: Option<String>,
        created_at: i64,
    }
    let article_meta_rows: Vec<ArticleMetaRow> = {
        let mut stmt = conn.prepare(
            "SELECT a.id, a.slug, a.title, a.status,
                    i.uuid AS thumb_uuid, a.gpx_filename, a.created_at
             FROM articles a
             LEFT JOIN images i ON i.id = a.thumbnail_image_id
             ORDER BY a.created_at DESC",
        )?;
        let x = stmt.query_map([], |row| {
            Ok(ArticleMetaRow {
                pk: row.get(0)?,
                slug: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                thumb_uuid: row.get(4)?,
                gpx_filename: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        x
    };

    let mut manifest_articles: Vec<ManifestArticlesItem> = Vec::new();
    let mut articles: HashMap<String, Article> = HashMap::new();

    for row in &article_meta_rows {
        let cat_slugs: Vec<ManifestArticlesItemCategoryIdsItem> = {
            let mut stmt = conn.prepare(
                "SELECT c.slug FROM article_categories ac
                 JOIN categories c ON c.id = ac.category_id
                 WHERE ac.article_id = ?",
            )?;
            let x = stmt.query_map([row.pk], |r| r.get::<_, String>(0))?
                .filter_map(|r| r.ok())
                .filter_map(|s| s.parse::<ManifestArticlesItemCategoryIdsItem>().ok())
                .collect();
            x
        };

        let status = if row.status == "published" {
            ManifestArticlesItemStatus::Published
        } else {
            ManifestArticlesItemStatus::Draft
        };

        manifest_articles.push(ManifestArticlesItem {
            id: ManifestArticlesItemId::try_from(row.slug.as_str())
                .unwrap_or_else(|_| ManifestArticlesItemId::try_from("unknown").unwrap()),
            title: row.title.clone(),
            status,
            category_ids: cat_slugs,
            thumbnail_file_id: row.thumb_uuid.as_deref().and_then(|s| s.parse().ok()),
            gpx_file_id: row.gpx_filename.clone(),
            created_at: row.created_at,
        });

        let content = load_article_blocks(&conn, row.pk)?;
        articles.insert(
            row.slug.clone(),
            Article {
                id: ArticleId::try_from(row.slug.as_str())
                    .unwrap_or_else(|_| ArticleId::try_from("unknown").unwrap()),
                content,
            },
        );
    }

    // ── map_memos ─────────────────────────────────────────────────────────
    let map_memos: Vec<ManifestMapMemosItem> = {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.kind, m.lat, m.lng, m.memo, i.uuid AS img_uuid
             FROM map_memos m
             LEFT JOIN images i ON i.id = m.image_id",
        )?;
        let x = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .map(|(id, kind, lat, lng, memo, img_uuid)| ManifestMapMemosItem {
            id: uuid::Uuid::from_u128(id as u128),
            kind,
            lat,
            lng,
            memo,
            image_id: img_uuid.as_deref().and_then(|s| s.parse().ok()),
        })
        .collect();
        x
    };

    let manifest = Manifest {
        version: 1,
        blog,
        categories,
        directories,
        articles: manifest_articles,
        map_memos,
    };

    Ok(BlogData { manifest, articles, files })
}

fn load_article_blocks(conn: &Connection, article_pk: i64) -> Result<Vec<ArticleContentItem>> {
    struct BlockRow {
        kind: String,
        text_content: Option<String>,
        img_uuid: Option<String>,
        description: Option<String>,
        gpx_filename: Option<String>,
    }
    let rows: Vec<BlockRow> = {
        let mut stmt = conn.prepare(
            "SELECT ab.kind, ab.text_content, i.uuid AS img_uuid, ab.description, ab.gpx_filename
             FROM article_blocks ab
             LEFT JOIN images i ON i.id = ab.image_id
             WHERE ab.article_id = ?
             ORDER BY ab.sort_order",
        )?;
        let x = stmt.query_map([article_pk], |row| {
            Ok(BlockRow {
                kind: row.get(0)?,
                text_content: row.get(1)?,
                img_uuid: row.get(2)?,
                description: row.get(3)?,
                gpx_filename: row.get(4)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        x
    };

    rows.into_iter()
        .map(|r| {
            Ok(match r.kind.as_str() {
                "text" => ArticleContentItem::Text {
                    text: r.text_content.unwrap_or_default(),
                },
                "image" => ArticleContentItem::Image {
                    file_id: r
                        .img_uuid
                        .as_deref()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(uuid::Uuid::nil()),
                    description: r.description,
                },
                "gpx" => ArticleContentItem::Gpx {
                    filename: r.gpx_filename.unwrap_or_default(),
                },
                other => anyhow::bail!("unknown block kind: {other}"),
            })
        })
        .collect()
}
