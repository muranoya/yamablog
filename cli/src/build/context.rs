use chrono::{DateTime, Datelike, NaiveDate, Utc};
use serde::Serialize;
use std::collections::HashMap;

use crate::schema::manifest::{ManifestArticlesItem, ManifestCategoriesItem};

#[derive(Serialize, Clone)]
pub struct MonthCount {
    pub month: u32,
    pub count: usize,
}

#[derive(Serialize, Clone)]
pub(super) struct CategoryWithCount {
    id: String,
    name: String,
    count: usize,
}

pub(super) fn calc_category_counts(
    articles: &[&ManifestArticlesItem],
    categories: &[ManifestCategoriesItem],
) -> Vec<CategoryWithCount> {
    categories
        .iter()
        .map(|cat| {
            let count = articles
                .iter()
                .filter(|a| {
                    a.category_ids
                        .iter()
                        .any(|cid| cid.as_str() == cat.id.as_str())
                })
                .count();
            CategoryWithCount {
                id: cat.id.to_string(),
                name: cat.name.clone(),
                count,
            }
        })
        .collect()
}

pub(super) fn calc_monthly_counts(
    articles: &[&ManifestArticlesItem],
    gpx_date_map: &HashMap<uuid::Uuid, NaiveDate>,
) -> Vec<MonthCount> {
    use std::collections::BTreeMap;
    let mut map: BTreeMap<u32, usize> = BTreeMap::new();
    for a in articles {
        if let Some(date) = a.gpx_file_id.and_then(|id| gpx_date_map.get(&id)) {
            *map.entry(date.month()).or_insert(0) += 1;
        }
    }
    let mut counts: Vec<MonthCount> = map
        .into_iter()
        .map(|(month, count)| MonthCount { month, count })
        .collect();
    counts.sort_by(|a, b| a.month.cmp(&b.month));
    counts
}

pub(super) fn build_gpx_date_map(
    files: &HashMap<String, crate::schema::files::DirectoryFiles>,
) -> HashMap<uuid::Uuid, NaiveDate> {
    use crate::schema::files::DirectoryFilesItem;
    let mut map = HashMap::new();
    for dir_files in files.values() {
        for item in dir_files.iter() {
            if let DirectoryFilesItem::Gpx { id, stats, .. } = item {
                if let Some(ts) = stats.start_at {
                    if let Some(dt) = DateTime::from_timestamp(ts, 0) {
                        map.insert(*id, dt.date_naive());
                    }
                }
            }
        }
    }
    map
}

pub(super) fn article_summary_to_value(
    a: &ManifestArticlesItem,
    categories: &[ManifestCategoriesItem],
    gpx_date_map: &HashMap<uuid::Uuid, NaiveDate>,
) -> serde_json::Value {
    let category_names: Vec<String> = a
        .category_ids
        .iter()
        .filter_map(|cid| {
            categories
                .iter()
                .find(|c| c.id.as_str() == cid.as_str())
                .map(|c| c.name.clone())
        })
        .collect();
    let hiking_date = a
        .gpx_file_id
        .and_then(|id| gpx_date_map.get(&id))
        .map(|d| format!("山行日: {}年{}月{}日", d.year(), d.month(), d.day()));
    serde_json::json!({
        "id": a.id.to_string(),
        "title": a.title,
        "created_at": format_timestamp(a.created_at),
        "hiking_date": hiking_date,
        "category_ids": a.category_ids.iter().map(|c| c.to_string()).collect::<Vec<_>>(),
        "category_names": category_names,
        "thumbnail_src": a.thumbnail_file_id.map(|id| format!("/images/{}-small.webp", id)),
    })
}

pub(super) fn format_timestamp(ts: i64) -> String {
    DateTime::from_timestamp(ts, 0)
        .map(|dt: DateTime<Utc>| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}
