use crate::build::gpx::GpxTrack;
use crate::schema::files::{DirectoryFiles, DirectoryFilesItem};
use crate::schema::manifest::ManifestArticlesItem;
use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Serialize)]
pub struct MapData {
    pub gpx_tracks: Vec<MapGpxTrack>,
    pub map_memos: Vec<MapMemoOut>,
}

#[derive(Serialize)]
pub struct MapGpxTrack {
    pub article_id: String,
    pub article_title: String,
    pub polyline: String,
    pub bbox: MapBbox,
}

#[derive(Serialize)]
pub struct MapBbox {
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lng: f64,
    pub max_lng: f64,
}

#[derive(Serialize)]
pub struct MapMemoOut {
    pub id: String,
    pub kind: i64,
    pub lat: f64,
    pub lng: f64,
    pub memo: String,
    pub image_id: Option<String>,
}

/// Collect GPX tracks for all published articles that have a GPX file in gpx_dir.
pub fn collect_gpx_tracks(
    published: &[&ManifestArticlesItem],
    files: &HashMap<String, DirectoryFiles>,
    gpx_dir: &Path,
) -> Vec<(String, String, GpxTrack)> {
    let gpx_names: HashMap<uuid::Uuid, String> = files
        .values()
        .flat_map(|d| d.iter())
        .filter_map(|f| {
            if let DirectoryFilesItem::Gpx { id, name, .. } = f {
                Some((*id, name.clone()))
            } else {
                None
            }
        })
        .collect();

    published
        .par_iter()
        .filter_map(|article| {
            let gpx_id = article.gpx_file_id?;
            let gpx_name = gpx_names.get(&gpx_id)?;
            let gpx_path = gpx_dir.join(gpx_name.as_str());
            match crate::build::gpx::read_and_parse_gpx(&gpx_path) {
                Ok(track) => Some((article.id.to_string(), article.title.clone(), track)),
                Err(e) => {
                    eprintln!(
                        "Warning: skipping GPX {} for article {}: {}",
                        gpx_id,
                        article.id.to_string(),
                        e
                    );
                    None
                }
            }
        })
        .collect()
}

pub fn build_map_data(
    map_memos_raw: &[crate::schema::manifest::ManifestMapMemosItem],
    gpx_tracks: &[(String, String, GpxTrack)],
) -> MapData {
    let gpx_tracks_out = gpx_tracks
        .par_iter()
        .map(|(article_id, article_title, track)| MapGpxTrack {
            article_id: article_id.clone(),
            article_title: article_title.clone(),
            polyline: crate::build::gpx::points_to_polyline(&crate::build::gpx::rdp_simplify(
                &track.points,
                0.0003,
            ))
            .unwrap_or_default(),
            bbox: MapBbox {
                min_lat: track.bbox.min_lat,
                max_lat: track.bbox.max_lat,
                min_lng: track.bbox.min_lng,
                max_lng: track.bbox.max_lng,
            },
        })
        .collect();

    let map_memos_out = map_memos_raw
        .iter()
        .map(|m| MapMemoOut {
            id: m.id.to_string(),
            kind: m.kind,
            lat: m.lat,
            lng: m.lng,
            memo: m.memo.clone(),
            image_id: m.image_id.as_ref().map(|id| id.to_string()),
        })
        .collect();

    MapData {
        gpx_tracks: gpx_tracks_out,
        map_memos: map_memos_out,
    }
}
