pub mod gpx;
pub mod html;
pub mod map_data;
pub mod markdown;
pub mod pagination;

use anyhow::Result;
use chrono::Datelike;
use serde::Serialize;
use std::path::Path;
use tera::Context;

use crate::data::load_blog_data;
use crate::schema::article::ArticleContentItem;
use crate::schema::manifest::{ManifestArticlesItem, ManifestArticlesItemStatus};

pub async fn run(
    data_dir: &Path,
    output_dir: &Path,
    dry_run: bool,
    r2_config: Option<crate::config::R2Config>,
) -> Result<()> {
    println!("Loading data from {}...", data_dir.display());
    let blog = load_blog_data(data_dir)?;
    let tera = html::create_tera()?;

    let uploader = if let Some(cfg) = &r2_config {
        Some(crate::upload::R2Uploader::new(cfg).await?)
    } else {
        None
    };

    // Filter to published articles, sort by updated_at descending
    let mut published: Vec<&ManifestArticlesItem> = blog
        .manifest
        .articles
        .iter()
        .filter(|a| a.status == ManifestArticlesItemStatus::Published)
        .collect();
    published.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    // Monthly counts for sidebar
    let monthly_counts = calc_monthly_counts(&published);

    // Common context fields
    let blog_name = &blog.manifest.blog.name;
    let sidebar_panels = &blog.manifest.blog.sidebar.panels;
    let categories = &blog.manifest.categories;

    // Helper: insert common context fields into a Context
    let build_ctx = || -> Result<Context> {
        let mut ctx = Context::new();
        ctx.insert("blog_name", blog_name);
        ctx.insert("sidebar_panels", sidebar_panels);
        ctx.insert("categories", categories);
        ctx.insert("monthly_counts", &monthly_counts);
        Ok(ctx)
    };

    // --- Article list pages ---
    let pages = pagination::paginate(&published, pagination::ARTICLES_PER_PAGE);
    for page in &pages {
        let mut ctx = build_ctx()?;
        // Serialize articles as JSON-compatible values for tera
        let articles_vals: Vec<serde_json::Value> = page
            .items
            .iter()
            .map(|a| article_summary_to_value(a))
            .collect();
        ctx.insert("articles", &articles_vals);
        ctx.insert("page_number", &page.page_number);
        ctx.insert("total_pages", &page.total_pages);
        let html_str = html::render(&tera, "article_list.html", &ctx)?;
        let key = if page.page_number == 1 {
            "index.html".to_string()
        } else {
            format!("{}/index.html", page.page_number)
        };
        write_or_upload(output_dir, &key, html_str, dry_run, uploader.as_ref()).await?;
        println!("  Generated: {key}");
    }

    // --- Article detail pages ---
    for article_summary in &published {
        let id_str = article_summary.id.to_string();
        if let Some(article) = blog.articles.get(&id_str) {
            let content_blocks = build_content_blocks(article).await?;
            let mut ctx = build_ctx()?;
            ctx.insert("article_title", &article_summary.title);
            ctx.insert(
                "article_created_at",
                &article_summary.created_at.to_string(),
            );
            ctx.insert("content_blocks", &content_blocks);
            let html_str = html::render(&tera, "article.html", &ctx)?;
            let key = format!("articles/{}/index.html", article_summary.id.as_str());
            write_or_upload(output_dir, &key, html_str, dry_run, uploader.as_ref()).await?;
            println!("  Generated: {key}");
        }
    }

    // --- Category pages ---
    for cat in &blog.manifest.categories {
        let cat_id_str = cat.id.to_string();
        let cat_articles: Vec<serde_json::Value> = published
            .iter()
            .filter(|a| a.category_ids.iter().any(|cid| cid.as_str() == cat_id_str))
            .map(|a| article_summary_to_value(a))
            .collect();

        let cat_pages = pagination::paginate(&cat_articles, pagination::ARTICLES_PER_PAGE);
        for page in &cat_pages {
            let mut ctx = build_ctx()?;
            ctx.insert("category_id", &cat_id_str);
            ctx.insert("category_name", &cat.name);
            ctx.insert("articles", &page.items);
            ctx.insert("page_number", &page.page_number);
            ctx.insert("total_pages", &page.total_pages);
            let html_str = html::render(&tera, "category.html", &ctx)?;
            let key = if page.page_number == 1 {
                format!("categories/{}/index.html", cat.id.as_str())
            } else {
                format!("categories/{}/{}/index.html", cat.id.as_str(), page.page_number)
            };
            write_or_upload(output_dir, &key, html_str, dry_run, uploader.as_ref()).await?;
            println!("  Generated: {key}");
        }
    }

    // --- Monthly archive pages ---
    for m in &monthly_counts {
        let prefix = format!("{}-{:02}", m.year, m.month);
        let month_articles: Vec<serde_json::Value> = published
            .iter()
            .filter(|a| a.created_at.to_string().starts_with(&prefix))
            .map(|a| article_summary_to_value(a))
            .collect();

        let mut ctx = build_ctx()?;
        ctx.insert("year", &m.year);
        ctx.insert("month", &format!("{:02}", m.month));
        ctx.insert("articles", &month_articles);
        let html_str = html::render(&tera, "archive.html", &ctx)?;
        let key = format!("archives/{}/{:02}/index.html", m.year, m.month);
        write_or_upload(output_dir, &key, html_str, dry_run, uploader.as_ref()).await?;
        println!("  Generated: {key}");
    }

    println!("Build complete!");
    Ok(())
}

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ContentBlock {
    kind: &'static str,
    // text
    #[serde(skip_serializing_if = "Option::is_none")]
    html: Option<String>,
    // image / gpx / binary
    #[serde(skip_serializing_if = "Option::is_none")]
    file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    // gpx
    #[serde(skip_serializing_if = "Option::is_none")]
    polyline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pins_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bbox_json: Option<String>,
}

async fn build_content_blocks(
    article: &crate::schema::article::Article,
) -> Result<Vec<ContentBlock>> {
    let mut blocks = Vec::new();

    for item in &article.content {
        match item {
            ArticleContentItem::Text { text } => {
                let html_str = markdown::markdown_to_html(text);
                blocks.push(ContentBlock {
                    kind: "text",
                    html: Some(html_str),
                    file_id: None,
                    description: None,
                    polyline: None,
                    pins_json: None,
                    bbox_json: None,
                });
            }
            ArticleContentItem::Image { file_id, description } => {
                blocks.push(ContentBlock {
                    kind: "image",
                    html: None,
                    file_id: Some(file_id.to_string()),
                    description: description.clone(),
                    polyline: None,
                    pins_json: None,
                    bbox_json: None,
                });
            }
            ArticleContentItem::Gpx { file_id } => {
                blocks.push(ContentBlock {
                    kind: "gpx",
                    html: None,
                    file_id: Some(file_id.to_string()),
                    description: None,
                    polyline: None,
                    pins_json: Some("[]".to_string()),
                    bbox_json: Some("{}".to_string()),
                });
            }
            ArticleContentItem::Binary { file_id } => {
                blocks.push(ContentBlock {
                    kind: "binary",
                    html: None,
                    file_id: Some(file_id.to_string()),
                    description: None,
                    polyline: None,
                    pins_json: None,
                    bbox_json: None,
                });
            }
        }
    }

    Ok(blocks)
}

// ---------------------------------------------------------------------------
// Monthly counts
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
pub struct MonthCount {
    pub year: i32,
    pub month: u32,
    pub count: usize,
}

fn calc_monthly_counts(articles: &[&ManifestArticlesItem]) -> Vec<MonthCount> {
    use std::collections::BTreeMap;
    let mut map: BTreeMap<(i32, u32), usize> = BTreeMap::new();
    for a in articles {
        let y = a.created_at.year();
        let m = a.created_at.month();
        *map.entry((y, m)).or_insert(0) += 1;
    }
    // Most recent first
    let mut counts: Vec<MonthCount> = map
        .into_iter()
        .map(|((year, month), count)| MonthCount { year, month, count })
        .collect();
    counts.sort_by(|a, b| b.year.cmp(&a.year).then(b.month.cmp(&a.month)));
    counts
}

// ---------------------------------------------------------------------------
// Serialize article summary for Tera context
// ---------------------------------------------------------------------------

fn article_summary_to_value(a: &ManifestArticlesItem) -> serde_json::Value {
    serde_json::json!({
        "id": a.id.to_string(),
        "title": a.title,
        "created_at": a.created_at.to_string(),
        "updated_at": a.updated_at.to_string(),
        "category_ids": a.category_ids.iter().map(|c| c.to_string()).collect::<Vec<_>>(),
    })
}

// ---------------------------------------------------------------------------
// Write output file (dry-run) or upload to R2 (not yet implemented)
// ---------------------------------------------------------------------------

async fn write_or_upload(
    output_dir: &Path,
    key: &str,
    html: String,
    dry_run: bool,
    uploader: Option<&crate::upload::R2Uploader>,
) -> Result<()> {
    if dry_run {
        let path = output_dir.join(key);
        std::fs::create_dir_all(path.parent().unwrap())?;
        std::fs::write(&path, html)?;
    } else if let Some(up) = uploader {
        up.upload_html(key, html).await?;
        println!("  Uploaded: {key}");
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn sample_data_dir() -> PathBuf {
        // Points at <repo>/data which is created as sample data
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        PathBuf::from(manifest_dir).join("..").join("data")
    }

    #[tokio::test]
    async fn test_dry_run_build() {
        let data_dir = sample_data_dir();
        if !data_dir.join("manifest.json").exists() {
            // Skip if sample data not present
            return;
        }
        let output_dir = std::env::temp_dir().join("yamablog-test-output");
        run(&data_dir, &output_dir, true, None)
            .await
            .expect("dry-run build should succeed");

        // Verify expected output files
        assert!(
            output_dir.join("index.html").exists(),
            "index.html should be generated"
        );
        assert!(
            output_dir.join("articles/test-article/index.html").exists(),
            "article page should be generated"
        );
        assert!(
            output_dir.join("categories/hiking/index.html").exists(),
            "category page should be generated"
        );
        assert!(
            output_dir.join("archives/2024/08/index.html").exists(),
            "archive page should be generated"
        );

        // Verify index.html contains expected content
        let index_html =
            std::fs::read_to_string(output_dir.join("index.html")).unwrap();
        assert!(index_html.contains("テストブログ"), "blog name in index");
        assert!(index_html.contains("テスト記事"), "article title in index");

        // Verify article page contains rendered markdown
        let article_html =
            std::fs::read_to_string(output_dir.join("articles/test-article/index.html"))
                .unwrap();
        assert!(article_html.contains("テスト"), "article content rendered");
    }
}
