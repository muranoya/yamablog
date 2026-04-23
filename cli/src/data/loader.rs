use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::Path;

use crate::schema::article::Article;
use crate::schema::files::DirectoryFiles;
use crate::schema::manifest::Manifest;

pub struct BlogData {
    pub manifest: Manifest,
    pub articles: HashMap<String, Article>,
    pub files: HashMap<String, DirectoryFiles>,
}

pub fn load_blog_data(data_dir: &Path) -> Result<BlogData> {
    let manifest: Manifest = {
        let path = data_dir.join("manifest.json");
        let json = std::fs::read_to_string(&path)
            .with_context(|| format!("cannot read {}", path.display()))?;
        serde_json::from_str(&json)
            .with_context(|| format!("invalid manifest.json: {}", path.display()))?
    };

    let mut articles = HashMap::new();
    let articles_dir = data_dir.join("articles");
    if articles_dir.exists() {
        for entry in std::fs::read_dir(&articles_dir)
            .with_context(|| format!("cannot read directory {}", articles_dir.display()))? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                let json = std::fs::read_to_string(&path)
                    .with_context(|| format!("cannot read {}", path.display()))?;
                let article: Article = serde_json::from_str(&json)
                    .with_context(|| format!("invalid article JSON: {}", path.display()))?;
                // ArticleId derefs to String
                let id: String = article.id.to_string();
                articles.insert(id, article);
            }
        }
    }

    let mut files = HashMap::new();
    let files_dir = data_dir.join("files");
    if files_dir.exists() {
        for entry in std::fs::read_dir(&files_dir)
            .with_context(|| format!("cannot read directory {}", files_dir.display()))? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                let dir_id = path
                    .file_stem()
                    .with_context(|| format!("invalid filename: {}", path.display()))?
                    .to_string_lossy()
                    .into_owned();
                let json = std::fs::read_to_string(&path)
                    .with_context(|| format!("cannot read {}", path.display()))?;
                // DirectoryFiles is a transparent newtype over Vec<DirectoryFilesItem>
                let dir_files: DirectoryFiles = serde_json::from_str(&json)
                    .with_context(|| format!("invalid files JSON: {}", path.display()))?;
                files.insert(dir_id, dir_files);
            }
        }
    }

    Ok(BlogData {
        manifest,
        articles,
        files,
    })
}
