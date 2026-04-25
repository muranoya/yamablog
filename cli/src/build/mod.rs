pub mod content_blocks;
pub mod context;
pub mod gpx;
pub mod html;
pub mod map_data;
pub mod markdown;
pub mod pagination;

use anyhow::{Context as _, Result};
use rayon::prelude::*;
use std::collections::HashMap;
use std::path::Path;
use tera::Context;

use crate::data::load_blog_data;
use crate::schema::manifest::ManifestArticlesItemStatus;
use std::fs;

use content_blocks::{build_content_blocks, build_file_index};
use context::{
    article_summary_to_value, build_gpx_date_map, calc_category_counts, calc_monthly_counts,
    format_timestamp,
};

struct BlogBundle {
    js_path: String,
    css_path: String,
    js_content: String,
    css_content: String,
}

fn load_blog_bundle(blog_dist: &Path) -> Result<BlogBundle> {
    let manifest_path = blog_dist.join(".vite/manifest.json");
    let manifest_str = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("blog/dist not found: {}", manifest_path.display()))?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_str)?;

    let entry = manifest["src/main.ts"]
        .as_object()
        .ok_or_else(|| anyhow::anyhow!("src/main.ts not found in Vite manifest"))?;

    let js_path = entry["file"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("file missing in Vite manifest entry"))?
        .to_string();

    let css_path = entry["css"]
        .as_array()
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("css missing in Vite manifest entry"))?
        .to_string();

    let js_content = std::fs::read_to_string(blog_dist.join(&js_path))?;
    let css_content = std::fs::read_to_string(blog_dist.join(&css_path))?;

    Ok(BlogBundle {
        js_path,
        css_path,
        js_content,
        css_content,
    })
}

fn fmt_duration(d: std::time::Duration) -> String {
    let ms = d.as_millis();
    if ms < 1000 {
        format!("{}ms", ms)
    } else {
        format!("{:.2}s", d.as_secs_f64())
    }
}

pub fn run(data_dir: &Path, output_dir: &Path, blog_dist: &Path) -> Result<()> {
    use std::time::Instant;

    let total_start = Instant::now();
    let preprocess_start = Instant::now();

    println!("Loading data from {}...", data_dir.display());
    let t = Instant::now();
    let blog = load_blog_data(data_dir)?;
    println!("  Loaded data [{}]", fmt_duration(t.elapsed()));

    let gpx_dir = data_dir.join("gpx");

    let t = Instant::now();
    let bundle = load_blog_bundle(blog_dist)?;
    println!("  Loaded bundle [{}]", fmt_duration(t.elapsed()));

    let t = Instant::now();
    let tera = html::create_tera()?;
    println!("  Initialized templates [{}]", fmt_duration(t.elapsed()));

    let t = Instant::now();
    let gpx_date_map = build_gpx_date_map(&blog.files);
    println!("  Built GPX date map [{}]", fmt_duration(t.elapsed()));

    let t = Instant::now();
    let file_index = build_file_index(&blog.files);
    println!("  Built file index [{}]", fmt_duration(t.elapsed()));

    let t = Instant::now();
    let mut published: Vec<&crate::schema::manifest::ManifestArticlesItem> = blog
        .manifest
        .articles
        .iter()
        .filter(|a| a.status == ManifestArticlesItemStatus::Published)
        .collect();
    published.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    println!("  Sorted articles [{}]", fmt_duration(t.elapsed()));

    let t = Instant::now();
    let monthly_counts = calc_monthly_counts(&published, &gpx_date_map);
    let blog_name = &blog.manifest.blog.name;
    let sidebar_panels = &blog.manifest.blog.sidebar.panels;
    let categories = &blog.manifest.categories;
    let categories_with_counts = calc_category_counts(&published, categories);
    println!("  Calculated counts [{}]", fmt_duration(t.elapsed()));

    let build_ctx = || -> Result<Context> {
        let mut ctx = Context::new();
        ctx.insert("blog_name", blog_name);
        ctx.insert("sidebar_panels", sidebar_panels);
        ctx.insert("categories", categories);
        ctx.insert("categories_with_counts", &categories_with_counts);
        ctx.insert("monthly_counts", &monthly_counts);
        ctx.insert("bundle_js", &bundle.js_path);
        ctx.insert("bundle_css", &bundle.css_path);
        Ok(ctx)
    };

    let preprocess_elapsed = preprocess_start.elapsed();
    println!("Pre-processing done [{}]", fmt_duration(preprocess_elapsed));

    let generate_start = Instant::now();

    // --- Article list pages ---
    let pages = pagination::paginate(&published, pagination::ARTICLES_PER_PAGE);
    for page in &pages {
        let t = Instant::now();
        let mut ctx = build_ctx()?;
        let articles_vals: Vec<serde_json::Value> = page
            .items
            .iter()
            .map(|a| article_summary_to_value(a, categories, &gpx_date_map))
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
        write_file(output_dir, &key, &html_str)?;
        println!("  Generated: {key} [{}]", fmt_duration(t.elapsed()));
    }

    // --- Article detail pages ---
    let categories_map: HashMap<&str, &str> = categories
        .iter()
        .map(|c| (c.id.as_str(), c.name.as_str()))
        .collect();

    let article_results: Vec<Result<(String, String, std::time::Duration)>> = published
        .par_iter()
        .filter_map(|article_summary| {
            let t = Instant::now();
            let id_str = article_summary.id.to_string();
            let article = blog.articles.get(&id_str)?;
            let r: Result<(String, String)> = (|| {
                let content_blocks = build_content_blocks(
                    article,
                    &file_index,
                    &gpx_dir,
                    &blog.manifest.map_memos,
                )?;
                let article_category_names: Vec<String> = article_summary
                    .category_ids
                    .iter()
                    .filter_map(|cid| categories_map.get(cid.as_str()).map(|n| n.to_string()))
                    .collect();
                let mut ctx = build_ctx()?;
                ctx.insert("article_title", &article_summary.title);
                ctx.insert(
                    "article_created_at",
                    &format_timestamp(article_summary.created_at),
                );
                ctx.insert("article_category_names", &article_category_names);
                ctx.insert("content_blocks", &content_blocks);
                let html_str = html::render(&tera, "article.html", &ctx)?;
                let key = format!("articles/{}/index.html", article_summary.id.as_str());
                Ok((key, html_str))
            })();
            Some(r.map(|(key, html)| (key, html, t.elapsed())))
        })
        .collect();

    for result in article_results {
        let (key, html_str, elapsed) = result?;
        write_file(output_dir, &key, &html_str)?;
        println!("  Generated: {key} [{}]", fmt_duration(elapsed));
    }

    // --- Category pages ---
    for cat in &blog.manifest.categories {
        let cat_id_str = cat.id.to_string();
        let cat_articles: Vec<serde_json::Value> = published
            .iter()
            .filter(|a| a.category_ids.iter().any(|cid| cid.as_str() == cat_id_str))
            .map(|a| article_summary_to_value(a, categories, &gpx_date_map))
            .collect();

        let cat_pages = pagination::paginate(&cat_articles, pagination::ARTICLES_PER_PAGE);
        for page in &cat_pages {
            let t = Instant::now();
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
                format!(
                    "categories/{}/{}/index.html",
                    cat.id.as_str(),
                    page.page_number
                )
            };
            write_file(output_dir, &key, &html_str)?;
            println!("  Generated: {key} [{}]", fmt_duration(t.elapsed()));
        }
    }

    // --- Monthly archive pages ---
    for m in &monthly_counts {
        use chrono::Datelike;
        let t = Instant::now();
        let month_articles: Vec<serde_json::Value> = published
            .iter()
            .filter(|a| {
                a.gpx_file_id
                    .and_then(|id| gpx_date_map.get(&id))
                    .map(|d| d.month() == m.month)
                    .unwrap_or(false)
            })
            .map(|a| article_summary_to_value(a, categories, &gpx_date_map))
            .collect();

        let mut ctx = build_ctx()?;
        ctx.insert("month", &m.month);
        ctx.insert("articles", &month_articles);
        let html_str = html::render(&tera, "archive.html", &ctx)?;
        let key = format!("archives/{}/index.html", m.month);
        write_file(output_dir, &key, &html_str)?;
        println!("  Generated: {key} [{}]", fmt_duration(t.elapsed()));
    }

    // --- map-data.json ---
    let t = Instant::now();
    let gpx_tracks = map_data::collect_gpx_tracks(&published, &blog.files, &gpx_dir);
    let map_data_out = map_data::build_map_data(&blog.manifest.map_memos, &gpx_tracks);
    let map_data_json = serde_json::to_string(&map_data_out)?;
    write_file(output_dir, "map-data.json", &map_data_json)?;
    println!("  Generated: map-data.json [{}]", fmt_duration(t.elapsed()));

    let t = Instant::now();
    write_file(output_dir, &bundle.css_path, &bundle.css_content)?;
    println!("  Generated: {} [{}]", bundle.css_path, fmt_duration(t.elapsed()));

    let t = Instant::now();
    write_file(output_dir, &bundle.js_path, &bundle.js_content)?;
    println!("  Generated: {} [{}]", bundle.js_path, fmt_duration(t.elapsed()));

    let generate_elapsed = generate_start.elapsed();
    let total_elapsed = total_start.elapsed();
    println!("---");
    println!("Pre-processing : {}", fmt_duration(preprocess_elapsed));
    println!("Generation     : {}", fmt_duration(generate_elapsed));
    println!("Total          : {}", fmt_duration(total_elapsed));
    println!("Build complete!");
    Ok(())
}

fn write_file(output_dir: &Path, key: &str, content: &str) -> Result<()> {
    let path = output_dir.join(key);
    fs::create_dir_all(path.parent().unwrap())?;
    fs::write(&path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn sample_data_dir() -> PathBuf {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        PathBuf::from(manifest_dir).join("..").join("data")
    }

    fn sample_blog_dist() -> PathBuf {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        PathBuf::from(manifest_dir).join("..").join("blog/dist")
    }

    #[test]
    fn test_dry_run_build() {
        let data_dir = sample_data_dir();
        if !data_dir.join("manifest.json").exists() {
            return;
        }
        let blog_dist = sample_blog_dist();
        if !blog_dist.join(".vite/manifest.json").exists() {
            return;
        }
        let output_dir = std::env::temp_dir().join("yamablog-test-output");
        run(&data_dir, &output_dir, &blog_dist).expect("build should succeed");

        assert!(
            output_dir.join("index.html").exists(),
            "index.html should be generated"
        );

        let index_html = std::fs::read_to_string(output_dir.join("index.html")).unwrap();
        assert!(
            index_html.contains("assets/bundle-"),
            "hashed bundle path in index"
        );
        assert!(
            index_html.contains(".css"),
            "bundle.css referenced in index"
        );
        assert!(index_html.contains(".js"), "bundle.js referenced in index");
    }
}
