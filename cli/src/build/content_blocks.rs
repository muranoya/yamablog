use anyhow::Result;
use chrono::DateTime;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

use crate::schema::article::{Article, ArticleContentItem};
use crate::schema::files::{DirectoryFiles, DirectoryFilesItem};
use crate::schema::manifest::ManifestMapMemosItem;

pub(super) type FilesIndex<'a> = HashMap<uuid::Uuid, &'a DirectoryFilesItem>;

#[derive(Serialize)]
pub(super) struct ContentBlock {
    kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    html: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    original_src: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    shooting_datetime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    polyline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pins_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bbox_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    distances_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    elevations_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stats_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    map_memos_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    medium_width: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    medium_height: Option<i64>,
}

#[derive(Serialize)]
struct GpxStatsOut {
    elapsed_seconds: Option<i64>,
    distance_m: f64,
    cum_climb_m: f64,
    cum_down_m: f64,
    max_elevation_m: f64,
    min_elevation_m: f64,
}

#[derive(Serialize)]
struct MapMemoInArticle {
    kind: i64,
    lat: f64,
    lng: f64,
    memo: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    image_id: Option<String>,
}

#[derive(Serialize)]
struct BboxOut {
    min_lat: f64,
    max_lat: f64,
    min_lng: f64,
    max_lng: f64,
}

pub(super) fn build_file_index(files: &HashMap<String, DirectoryFiles>) -> FilesIndex<'_> {
    files
        .values()
        .flat_map(|d| d.iter())
        .map(|f| {
            let id = match f {
                DirectoryFilesItem::Image { id, .. } => *id,
                DirectoryFilesItem::Gpx { id, .. } => *id,
            };
            (id, f)
        })
        .collect()
}

fn find_gpx_name(index: &FilesIndex<'_>, file_id: &uuid::Uuid) -> Option<String> {
    if let DirectoryFilesItem::Gpx { name, .. } = index.get(file_id)? {
        Some(name.clone())
    } else {
        None
    }
}

pub(super) fn build_content_blocks(
    article: &Article,
    index: &FilesIndex<'_>,
    gpx_dir: &Path,
    all_map_memos: &[ManifestMapMemosItem],
) -> Result<Vec<ContentBlock>> {
    let mut blocks = Vec::new();

    // Pre-collect image infos (datetime + file_id + description) for GPX pin matching
    let image_infos = collect_image_infos(article, index);

    for item in &article.content {
        match item {
            ArticleContentItem::Text { text } => {
                let html_str = super::markdown::markdown_to_html(text);
                blocks.push(ContentBlock {
                    kind: "text",
                    html: Some(html_str),
                    file_id: None,
                    description: None,
                    original_src: None,
                    shooting_datetime: None,
                    polyline: None,
                    pins_json: None,
                    bbox_json: None,
                    distances_json: None,
                    elevations_json: None,
                    stats_json: None,
                    map_memos_json: None,
                    medium_width: None,
                    medium_height: None,
                });
            }
            ArticleContentItem::Image {
                file_id,
                description,
            } => {
                let shooting_dt = find_shooting_datetime(index, file_id);
                let medium_size = find_medium_image_size(index, file_id);
                blocks.push(ContentBlock {
                    kind: "image",
                    html: None,
                    file_id: Some(file_id.to_string()),
                    description: description.clone(),
                    original_src: Some(format!("/images/{}-original.webp", file_id)),
                    shooting_datetime: shooting_dt,
                    polyline: None,
                    pins_json: None,
                    bbox_json: None,
                    distances_json: None,
                    elevations_json: None,
                    stats_json: None,
                    map_memos_json: None,
                    medium_width: medium_size.map(|(w, _)| w),
                    medium_height: medium_size.map(|(_, h)| h),
                });
            }
            ArticleContentItem::Gpx { file_id } => {
                let gpx_name =
                    find_gpx_name(index, file_id).unwrap_or_else(|| format!("{}.gpx", file_id));
                let gpx_path = gpx_dir.join(&gpx_name);
                match super::gpx::read_and_parse_gpx(&gpx_path) {
                    Ok(track) => {
                        let (distances, elevations) =
                            super::gpx::calc_elevation_profile(&track.points);
                        let pins = super::gpx::match_pins(&image_infos, &track);
                        let bbox = BboxOut {
                            min_lat: track.bbox.min_lat,
                            max_lat: track.bbox.max_lat,
                            min_lng: track.bbox.min_lng,
                            max_lng: track.bbox.max_lng,
                        };
                        let map_polyline = super::gpx::points_to_polyline(
                            &super::gpx::rdp_simplify(&track.points, 0.0001),
                        )?;
                        let (dist_json, elev_json) = if distances.is_empty() {
                            (None, None)
                        } else {
                            (
                                Some(serde_json::to_string(&distances)?),
                                Some(serde_json::to_string(&elevations)?),
                            )
                        };
                        let stats = find_gpx_stats(index, file_id);
                        const MARGIN: f64 = 0.05; // ~5km
                        let local_memos: Vec<MapMemoInArticle> = all_map_memos
                            .iter()
                            .filter(|m| {
                                m.lat >= track.bbox.min_lat - MARGIN
                                    && m.lat <= track.bbox.max_lat + MARGIN
                                    && m.lng >= track.bbox.min_lng - MARGIN
                                    && m.lng <= track.bbox.max_lng + MARGIN
                            })
                            .map(|m| MapMemoInArticle {
                                kind: m.kind,
                                lat: m.lat,
                                lng: m.lng,
                                memo: m.memo.clone(),
                                image_id: m.image_id.map(|id| id.to_string()),
                            })
                            .collect();
                        blocks.push(ContentBlock {
                            kind: "gpx",
                            html: None,
                            file_id: Some(file_id.to_string()),
                            description: None,
                            original_src: None,
                            shooting_datetime: None,
                            polyline: Some(map_polyline),
                            pins_json: Some(serde_json::to_string(&pins)?),
                            bbox_json: Some(serde_json::to_string(&bbox)?),
                            distances_json: dist_json,
                            elevations_json: elev_json,
                            stats_json: stats.map(|s| serde_json::to_string(&s)).transpose()?,
                            map_memos_json: Some(serde_json::to_string(&local_memos)?),
                            medium_width: None,
                            medium_height: None,
                        });
                    }
                    Err(e) => {
                        eprintln!("Warning: failed to read GPX {}: {}", file_id, e);
                        blocks.push(ContentBlock {
                            kind: "gpx",
                            html: None,
                            file_id: Some(file_id.to_string()),
                            description: None,
                            original_src: None,
                            shooting_datetime: None,
                            polyline: Some(String::new()),
                            pins_json: Some("[]".to_string()),
                            bbox_json: Some("{}".to_string()),
                            distances_json: None,
                            elevations_json: None,
                            stats_json: None,
                            map_memos_json: Some("[]".to_string()),
                            medium_width: None,
                            medium_height: None,
                        });
                    }
                }
            }
            ArticleContentItem::Binary { file_id } => {
                blocks.push(ContentBlock {
                    kind: "binary",
                    html: None,
                    file_id: Some(file_id.to_string()),
                    description: None,
                    original_src: None,
                    shooting_datetime: None,
                    polyline: None,
                    pins_json: None,
                    bbox_json: None,
                    distances_json: None,
                    elevations_json: None,
                    stats_json: None,
                    map_memos_json: None,
                    medium_width: None,
                    medium_height: None,
                });
            }
        }
    }

    Ok(blocks)
}

fn find_gpx_stats(index: &FilesIndex<'_>, file_id: &uuid::Uuid) -> Option<GpxStatsOut> {
    if let DirectoryFilesItem::Gpx { stats, .. } = index.get(file_id)? {
        let elapsed = match (stats.start_at, stats.end_at) {
            (Some(s), Some(e)) => Some(e - s),
            _ => None,
        };
        Some(GpxStatsOut {
            elapsed_seconds: elapsed,
            distance_m: stats.distance_m,
            cum_climb_m: stats.cum_climb_m,
            cum_down_m: stats.cum_down_m,
            max_elevation_m: stats.max_elevation_m,
            min_elevation_m: stats.min_elevation_m,
        })
    } else {
        None
    }
}

fn find_shooting_datetime(index: &FilesIndex<'_>, file_id: &uuid::Uuid) -> Option<String> {
    let jst = chrono::FixedOffset::east_opt(9 * 3600)?;
    if let DirectoryFilesItem::Image {
        shooting_datetime, ..
    } = index.get(file_id)?
    {
        let ts = (*shooting_datetime)?;
        let dt_jst = DateTime::from_timestamp(ts, 0)?.with_timezone(&jst);
        Some(format!("{}", dt_jst.format("%Y/%m/%d %H:%M")))
    } else {
        None
    }
}

fn find_medium_image_size(index: &FilesIndex<'_>, file_id: &uuid::Uuid) -> Option<(i64, i64)> {
    if let DirectoryFilesItem::Image { sizes, .. } = index.get(file_id)? {
        Some((sizes.medium.width, sizes.medium.height))
    } else {
        None
    }
}

fn collect_image_infos(
    article: &Article,
    index: &FilesIndex<'_>,
) -> Vec<super::gpx::ImageInfo> {
    article
        .content
        .iter()
        .filter_map(|item| {
            let ArticleContentItem::Image {
                file_id,
                description,
            } = item
            else {
                return None;
            };
            if let DirectoryFilesItem::Image {
                shooting_datetime, ..
            } = index.get(file_id)?
            {
                let ts = (*shooting_datetime)?;
                let datetime = DateTime::from_timestamp(ts, 0).map(|dt| dt.fixed_offset())?;
                Some(super::gpx::ImageInfo {
                    datetime,
                    file_id: file_id.to_string(),
                    description: description.clone(),
                })
            } else {
                None
            }
        })
        .collect()
}
