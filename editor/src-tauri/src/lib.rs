use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

pub struct DbState(pub Mutex<Option<Connection>>);

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// ── Return types ──────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DbBlogConfig {
    pub name: String,
    pub top_image_id: Option<i64>,
    pub top_image_uuid: Option<String>,
    pub updated_at: i64,
}

#[derive(Serialize)]
pub struct DbCategory {
    pub id: i64,
    pub slug: String,
    pub name: String,
    pub priority: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize)]
pub struct DbDirectory {
    pub id: i64,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize)]
pub struct DbArticleSummary {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub status: String,
    pub thumbnail_image_id: Option<i64>,
    pub thumbnail_image_uuid: Option<String>,
    pub gpx_filename: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub category_ids: Vec<i64>,
}

#[derive(Serialize)]
pub struct DbMapMemo {
    pub id: i64,
    pub kind: i64,
    pub lat: f64,
    pub lng: f64,
    pub memo: String,
    pub image_id: Option<i64>,
    pub image_uuid: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize)]
pub struct AllData {
    pub blog: DbBlogConfig,
    pub categories: Vec<DbCategory>,
    pub directories: Vec<DbDirectory>,
    pub articles: Vec<DbArticleSummary>,
    pub map_memos: Vec<DbMapMemo>,
}

#[derive(Serialize)]
pub struct DbBlock {
    pub id: i64,
    pub sort_order: i64,
    pub kind: String,
    pub text_content: Option<String>,
    pub image_id: Option<i64>,
    pub image_uuid: Option<String>,
    pub description: Option<String>,
    pub gpx_filename: Option<String>,
}

#[derive(Serialize)]
pub struct DbImage {
    pub id: i64,
    pub uuid: String,
    pub name: String,
    pub small_width: Option<i64>,
    pub small_height: Option<i64>,
    pub medium_width: Option<i64>,
    pub medium_height: Option<i64>,
    pub original_width: i64,
    pub original_height: i64,
    pub shooting_datetime: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

// ── Input types ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpsertBlogConfigInput {
    pub name: String,
    pub top_image_id: Option<i64>,
}

#[derive(Deserialize)]
pub struct UpsertCategoryInput {
    pub id: Option<i64>,
    pub slug: String,
    pub name: String,
    pub priority: i64,
}

#[derive(Deserialize)]
pub struct UpsertDirectoryInput {
    pub id: Option<i64>,
    pub name: String,
}

#[derive(Deserialize)]
pub struct UpsertBlockInput {
    pub kind: String,
    pub text_content: Option<String>,
    pub image_id: Option<i64>,
    pub description: Option<String>,
    pub gpx_filename: Option<String>,
}

#[derive(Deserialize)]
pub struct UpsertArticleInput {
    pub id: Option<i64>,
    pub slug: String,
    pub title: String,
    pub status: String,
    pub thumbnail_image_id: Option<i64>,
    pub gpx_filename: Option<String>,
    pub created_at: Option<i64>,
    pub category_ids: Vec<i64>,
    pub blocks: Vec<UpsertBlockInput>,
}

#[derive(Deserialize)]
pub struct UpsertImageInput {
    pub id: Option<i64>,
    pub uuid: String,
    pub directory_id: i64,
    pub name: String,
    pub small_width: Option<i64>,
    pub small_height: Option<i64>,
    pub medium_width: Option<i64>,
    pub medium_height: Option<i64>,
    pub original_width: i64,
    pub original_height: i64,
    pub shooting_datetime: Option<i64>,
}

#[derive(Deserialize)]
pub struct UpsertMapMemoInput {
    pub id: Option<i64>,
    pub kind: i64,
    pub lat: f64,
    pub lng: f64,
    pub memo: String,
    pub image_id: Option<i64>,
}

// ── Commands ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn open_data_dir_dialog(
    app: tauri::AppHandle,
    state: tauri::State<'_, DbState>,
) -> Result<Option<String>, String> {
    let (tx, rx) = oneshot::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });
    let maybe_path = rx.await.ok().flatten();
    if let Some(p) = maybe_path {
        let dir_str = p.to_string();
        open_sqlite(&dir_str, &state)?;
        return Ok(Some(dir_str));
    }
    Ok(None)
}

#[tauri::command]
fn open_db_from_data_dir(
    state: tauri::State<DbState>,
    data_dir: String,
) -> Result<(), String> {
    open_sqlite(&data_dir, &state)
}

fn open_sqlite(data_dir: &str, state: &tauri::State<DbState>) -> Result<(), String> {
    let db_path = format!("{}/blog.sqlite3", data_dir);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 1;",
    )
    .map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = Some(conn);
    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{}: {}", path, e))
}

#[tauri::command]
fn db_get_all_data(state: tauri::State<DbState>) -> Result<AllData, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;

    let blog = conn
        .query_row(
            "SELECT bc.name, bc.top_image_id, i.uuid, bc.updated_at
             FROM blog_config bc
             LEFT JOIN images i ON i.id = bc.top_image_id
             WHERE bc.id = 1",
            [],
            |row| {
                Ok(DbBlogConfig {
                    name: row.get(0)?,
                    top_image_id: row.get(1)?,
                    top_image_uuid: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let categories = {
        let mut stmt = conn
            .prepare(
                "SELECT id, slug, name, priority, created_at, updated_at
                 FROM categories ORDER BY priority",
            )
            .map_err(|e| e.to_string())?;
        let x: Vec<DbCategory> = stmt
            .query_map([], |row| {
                Ok(DbCategory {
                    id: row.get(0)?,
                    slug: row.get(1)?,
                    name: row.get(2)?,
                    priority: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        x
    };

    let directories = {
        let mut stmt = conn
            .prepare("SELECT id, name, created_at, updated_at FROM directories ORDER BY id")
            .map_err(|e| e.to_string())?;
        let x: Vec<DbDirectory> = stmt
            .query_map([], |row| {
                Ok(DbDirectory {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        x
    };

    let articles = {
        struct ArticleRow {
            id: i64,
            slug: String,
            title: String,
            status: String,
            thumbnail_image_id: Option<i64>,
            thumbnail_image_uuid: Option<String>,
            gpx_filename: Option<String>,
            created_at: i64,
            updated_at: i64,
        }
        let mut stmt = conn
            .prepare(
                "SELECT a.id, a.slug, a.title, a.status,
                        a.thumbnail_image_id, i.uuid,
                        a.gpx_filename, a.created_at, a.updated_at
                 FROM articles a
                 LEFT JOIN images i ON i.id = a.thumbnail_image_id
                 ORDER BY a.created_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<ArticleRow> = stmt
            .query_map([], |row| {
                Ok(ArticleRow {
                    id: row.get(0)?,
                    slug: row.get(1)?,
                    title: row.get(2)?,
                    status: row.get(3)?,
                    thumbnail_image_id: row.get(4)?,
                    thumbnail_image_uuid: row.get(5)?,
                    gpx_filename: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            let cat_ids: Vec<i64> = {
                let mut stmt2 = conn
                    .prepare(
                        "SELECT category_id FROM article_categories WHERE article_id = ?",
                    )
                    .map_err(|e| e.to_string())?;
                let x = stmt2
                    .query_map([row.id], |r| r.get::<_, i64>(0))
                    .map_err(|e| e.to_string())?
                    .filter_map(|r| r.ok())
                    .collect();
                x
            };
            result.push(DbArticleSummary {
                id: row.id,
                slug: row.slug,
                title: row.title,
                status: row.status,
                thumbnail_image_id: row.thumbnail_image_id,
                thumbnail_image_uuid: row.thumbnail_image_uuid,
                gpx_filename: row.gpx_filename,
                created_at: row.created_at,
                updated_at: row.updated_at,
                category_ids: cat_ids,
            });
        }
        result
    };

    let map_memos = {
        let mut stmt = conn
            .prepare(
                "SELECT m.id, m.kind, m.lat, m.lng, m.memo,
                        m.image_id, i.uuid, m.created_at, m.updated_at
                 FROM map_memos m
                 LEFT JOIN images i ON i.id = m.image_id",
            )
            .map_err(|e| e.to_string())?;
        let x: Vec<DbMapMemo> = stmt
            .query_map([], |row| {
                Ok(DbMapMemo {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    lat: row.get(2)?,
                    lng: row.get(3)?,
                    memo: row.get(4)?,
                    image_id: row.get(5)?,
                    image_uuid: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        x
    };

    Ok(AllData {
        blog,
        categories,
        directories,
        articles,
        map_memos,
    })
}

#[tauri::command]
fn db_get_article_blocks(
    state: tauri::State<DbState>,
    article_id: i64,
) -> Result<Vec<DbBlock>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    let mut stmt = conn
        .prepare(
            "SELECT ab.id, ab.sort_order, ab.kind,
                    ab.text_content, ab.image_id, i.uuid,
                    ab.description, ab.gpx_filename
             FROM article_blocks ab
             LEFT JOIN images i ON i.id = ab.image_id
             WHERE ab.article_id = ?
             ORDER BY ab.sort_order",
        )
        .map_err(|e| e.to_string())?;
    let x: Vec<DbBlock> = stmt
        .query_map([article_id], |row| {
            Ok(DbBlock {
                id: row.get(0)?,
                sort_order: row.get(1)?,
                kind: row.get(2)?,
                text_content: row.get(3)?,
                image_id: row.get(4)?,
                image_uuid: row.get(5)?,
                description: row.get(6)?,
                gpx_filename: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(x)
}

#[tauri::command]
fn db_get_directory_images(
    state: tauri::State<DbState>,
    directory_id: i64,
) -> Result<Vec<DbImage>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    let mut stmt = conn
        .prepare(
            "SELECT id, uuid, name,
                    small_width, small_height, medium_width, medium_height,
                    original_width, original_height, shooting_datetime,
                    created_at, updated_at
             FROM images
             WHERE directory_id = ?
             ORDER BY shooting_datetime ASC NULLS LAST, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let x: Vec<DbImage> = stmt
        .query_map([directory_id], |row| {
            Ok(DbImage {
                id: row.get(0)?,
                uuid: row.get(1)?,
                name: row.get(2)?,
                small_width: row.get(3)?,
                small_height: row.get(4)?,
                medium_width: row.get(5)?,
                medium_height: row.get(6)?,
                original_width: row.get(7)?,
                original_height: row.get(8)?,
                shooting_datetime: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(x)
}

#[tauri::command]
fn db_upsert_blog_config(
    state: tauri::State<DbState>,
    input: UpsertBlogConfigInput,
) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    conn.execute(
        "UPDATE blog_config SET name=?, top_image_id=?, updated_at=? WHERE id=1",
        params![input.name, input.top_image_id, now_ts()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_upsert_category(
    state: tauri::State<DbState>,
    input: UpsertCategoryInput,
) -> Result<i64, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    let now = now_ts();
    if let Some(id) = input.id {
        conn.execute(
            "UPDATE categories SET slug=?, name=?, priority=?, updated_at=? WHERE id=?",
            params![input.slug, input.name, input.priority, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO categories (slug, name, priority, created_at, updated_at)
             VALUES (?,?,?,?,?)",
            params![input.slug, input.name, input.priority, now, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn db_delete_category(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    conn.execute("DELETE FROM categories WHERE id=?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_upsert_directory(
    state: tauri::State<DbState>,
    input: UpsertDirectoryInput,
) -> Result<i64, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    let now = now_ts();
    if let Some(id) = input.id {
        conn.execute(
            "UPDATE directories SET name=?, updated_at=? WHERE id=?",
            params![input.name, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO directories (name, created_at, updated_at) VALUES (?,?,?)",
            params![input.name, now, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn db_delete_directory(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    conn.execute("DELETE FROM directories WHERE id=?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_upsert_article(
    state: tauri::State<DbState>,
    input: UpsertArticleInput,
) -> Result<i64, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_mut().ok_or("Database not opened")?;
    let now = now_ts();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let article_id = if let Some(id) = input.id {
        tx.execute(
            "UPDATE articles
             SET slug=?, title=?, status=?, thumbnail_image_id=?, gpx_filename=?, updated_at=?
             WHERE id=?",
            params![
                input.slug,
                input.title,
                input.status,
                input.thumbnail_image_id,
                input.gpx_filename,
                now,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
        id
    } else {
        let created_at = input.created_at.unwrap_or(now);
        tx.execute(
            "INSERT INTO articles
             (slug, title, status, thumbnail_image_id, gpx_filename, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?)",
            params![
                input.slug,
                input.title,
                input.status,
                input.thumbnail_image_id,
                input.gpx_filename,
                created_at,
                now
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.last_insert_rowid()
    };

    tx.execute(
        "DELETE FROM article_categories WHERE article_id=?",
        [article_id],
    )
    .map_err(|e| e.to_string())?;
    for cat_id in &input.category_ids {
        tx.execute(
            "INSERT INTO article_categories (article_id, category_id) VALUES (?,?)",
            [article_id, *cat_id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "DELETE FROM article_blocks WHERE article_id=?",
        [article_id],
    )
    .map_err(|e| e.to_string())?;
    for (idx, block) in input.blocks.iter().enumerate() {
        tx.execute(
            "INSERT INTO article_blocks
             (article_id, sort_order, kind, text_content, image_id, description, gpx_filename)
             VALUES (?,?,?,?,?,?,?)",
            params![
                article_id,
                idx as i64,
                block.kind,
                block.text_content,
                block.image_id,
                block.description,
                block.gpx_filename
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(article_id)
}

#[tauri::command]
fn db_delete_article(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    conn.execute("DELETE FROM articles WHERE id=?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_upsert_image(
    state: tauri::State<DbState>,
    input: UpsertImageInput,
) -> Result<i64, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    let now = now_ts();
    if let Some(id) = input.id {
        conn.execute(
            "UPDATE images
             SET uuid=?, directory_id=?, name=?,
                 small_width=?, small_height=?, medium_width=?, medium_height=?,
                 original_width=?, original_height=?, shooting_datetime=?, updated_at=?
             WHERE id=?",
            params![
                input.uuid,
                input.directory_id,
                input.name,
                input.small_width,
                input.small_height,
                input.medium_width,
                input.medium_height,
                input.original_width,
                input.original_height,
                input.shooting_datetime,
                now,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO images
             (uuid, directory_id, name,
              small_width, small_height, medium_width, medium_height,
              original_width, original_height, shooting_datetime, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            params![
                input.uuid,
                input.directory_id,
                input.name,
                input.small_width,
                input.small_height,
                input.medium_width,
                input.medium_height,
                input.original_width,
                input.original_height,
                input.shooting_datetime,
                now,
                now
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn db_delete_image(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    conn.execute("DELETE FROM images WHERE id=?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_upsert_map_memo(
    state: tauri::State<DbState>,
    input: UpsertMapMemoInput,
) -> Result<i64, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    let now = now_ts();
    if let Some(id) = input.id {
        conn.execute(
            "UPDATE map_memos
             SET kind=?, lat=?, lng=?, memo=?, image_id=?, updated_at=?
             WHERE id=?",
            params![input.kind, input.lat, input.lng, input.memo, input.image_id, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO map_memos (kind, lat, lng, memo, image_id, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?)",
            params![
                input.kind, input.lat, input.lng, input.memo, input.image_id, now, now
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn db_delete_map_memo(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not opened")?;
    conn.execute("DELETE FROM map_memos WHERE id=?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DbState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_data_dir_dialog,
            open_db_from_data_dir,
            read_file,
            db_get_all_data,
            db_get_article_blocks,
            db_get_directory_images,
            db_upsert_blog_config,
            db_upsert_category,
            db_delete_category,
            db_upsert_directory,
            db_delete_directory,
            db_upsert_article,
            db_delete_article,
            db_upsert_image,
            db_delete_image,
            db_upsert_map_memo,
            db_delete_map_memo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
