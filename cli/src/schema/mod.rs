#![allow(dead_code)]

use serde::Serialize;
use std::convert::Infallible;
use std::fmt;
use std::str::FromStr;

pub mod manifest {
    use super::*;

    #[derive(Clone, Serialize)]
    #[serde(transparent)]
    pub struct ManifestCategoriesItemId(String);

    impl TryFrom<&str> for ManifestCategoriesItemId {
        type Error = Infallible;
        fn try_from(s: &str) -> Result<Self, Infallible> {
            Ok(Self(s.to_owned()))
        }
    }

    impl ManifestCategoriesItemId {
        pub fn as_str(&self) -> &str {
            &self.0
        }
    }

    impl fmt::Display for ManifestCategoriesItemId {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str(&self.0)
        }
    }

    #[derive(Clone, Serialize)]
    pub struct ManifestCategoriesItem {
        pub id: ManifestCategoriesItemId,
        pub name: String,
        pub priority: i64,
    }

    pub struct ManifestDirectoriesItem {
        pub id: uuid::Uuid,
        pub name: String,
        pub created_at: i64,
    }

    #[derive(Clone)]
    pub struct ManifestArticlesItemId(String);

    impl TryFrom<&str> for ManifestArticlesItemId {
        type Error = Infallible;
        fn try_from(s: &str) -> Result<Self, Infallible> {
            Ok(Self(s.to_owned()))
        }
    }

    impl ManifestArticlesItemId {
        pub fn as_str(&self) -> &str {
            &self.0
        }
    }

    impl fmt::Display for ManifestArticlesItemId {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str(&self.0)
        }
    }

    #[derive(PartialEq)]
    pub enum ManifestArticlesItemStatus {
        Published,
        Draft,
    }

    #[derive(Clone)]
    pub struct ManifestArticlesItemCategoryIdsItem(String);

    impl ManifestArticlesItemCategoryIdsItem {
        pub fn as_str(&self) -> &str {
            &self.0
        }
    }

    impl fmt::Display for ManifestArticlesItemCategoryIdsItem {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str(&self.0)
        }
    }

    impl FromStr for ManifestArticlesItemCategoryIdsItem {
        type Err = Infallible;
        fn from_str(s: &str) -> Result<Self, Infallible> {
            Ok(Self(s.to_owned()))
        }
    }

    pub struct ManifestArticlesItem {
        pub id: ManifestArticlesItemId,
        pub title: String,
        pub status: ManifestArticlesItemStatus,
        pub category_ids: Vec<ManifestArticlesItemCategoryIdsItem>,
        pub thumbnail_file_id: Option<uuid::Uuid>,
        pub gpx_file_id: Option<String>,
        pub created_at: i64,
    }

    pub struct ManifestMapMemosItem {
        pub id: uuid::Uuid,
        pub kind: i64,
        pub lat: f64,
        pub lng: f64,
        pub memo: String,
        pub image_id: Option<uuid::Uuid>,
    }

    pub struct ManifestBlog {
        pub name: String,
        pub top_image_id: Option<uuid::Uuid>,
    }

    pub struct Manifest {
        pub version: i64,
        pub blog: ManifestBlog,
        pub categories: Vec<ManifestCategoriesItem>,
        pub directories: Vec<ManifestDirectoriesItem>,
        pub articles: Vec<ManifestArticlesItem>,
        pub map_memos: Vec<ManifestMapMemosItem>,
    }
}

pub mod article {
    use std::convert::Infallible;

    pub struct ArticleId(String);

    impl TryFrom<&str> for ArticleId {
        type Error = Infallible;
        fn try_from(s: &str) -> Result<Self, Infallible> {
            Ok(Self(s.to_owned()))
        }
    }

    pub enum ArticleContentItem {
        Text { text: String },
        Image { file_id: uuid::Uuid, description: Option<String> },
        Gpx { filename: String },
    }

    pub struct Article {
        pub id: ArticleId,
        pub content: Vec<ArticleContentItem>,
    }
}

pub mod files {
    pub struct ImageSize {
        pub width: i64,
        pub height: i64,
    }

    pub struct DirectoryFilesItemSizes {
        pub small: Option<ImageSize>,
        pub medium: Option<ImageSize>,
        pub original: ImageSize,
    }

    pub struct DirectoryFilesItem {
        pub id: uuid::Uuid,
        pub kind: String,
        pub name: String,
        pub shooting_datetime: Option<i64>,
        pub sizes: DirectoryFilesItemSizes,
    }

    pub struct DirectoryFiles(pub Vec<DirectoryFilesItem>);

    impl DirectoryFiles {
        pub fn iter(&self) -> std::slice::Iter<'_, DirectoryFilesItem> {
            self.0.iter()
        }
    }
}
