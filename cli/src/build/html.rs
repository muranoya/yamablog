use anyhow::Result;
use tera::{Context, Tera};

pub fn create_tera() -> Result<Tera> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let pattern = format!("{manifest_dir}/templates/**/*.html");
    Tera::new(&pattern).map_err(|e| anyhow::anyhow!("template error: {e}"))
}

pub fn render(tera: &Tera, template: &str, ctx: &Context) -> Result<String> {
    tera.render(template, ctx)
        .map_err(|e| anyhow::anyhow!("render error in {template}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_templates_load() {
        let tera = create_tera().expect("Tera templates should load");
        assert!(tera.get_template_names().any(|n| n == "base.html"));
        assert!(tera.get_template_names().any(|n| n == "article_list.html"));
        assert!(tera.get_template_names().any(|n| n == "article.html"));
    }

    #[test]
    fn test_render_article_list() {
        let tera = create_tera().unwrap();
        let mut ctx = Context::new();
        ctx.insert("blog_name", "Test Blog");
        ctx.insert("sidebar_panels", &Vec::<serde_json::Value>::new());
        ctx.insert("categories", &Vec::<serde_json::Value>::new());
        ctx.insert("monthly_counts", &Vec::<serde_json::Value>::new());
        ctx.insert("articles", &Vec::<serde_json::Value>::new());
        ctx.insert("page_number", &1u32);
        ctx.insert("total_pages", &1u32);
        let html = render(&tera, "article_list.html", &ctx).unwrap();
        assert!(html.contains("Test Blog"));
        assert!(html.contains("記事一覧"));
    }
}
