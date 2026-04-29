use crate::build::gpx::GpxTrack;
use crate::schema::files::DirectoryFilesItem;
use crate::schema::manifest::{ManifestArticlesItem, ManifestMapMemosItem};
use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;

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
    pub image_small_src: Option<String>,
}

pub fn build_map_data(
    map_memos_raw: &[ManifestMapMemosItem],
    published: &[&ManifestArticlesItem],
    gpx_cache: &HashMap<String, GpxTrack>,
    file_index: &HashMap<uuid::Uuid, &DirectoryFilesItem>,
) -> MapData {
    let gpx_tracks_out: Vec<MapGpxTrack> = published
        .par_iter()
        .filter_map(|article| {
            let gpx_filename = article.gpx_file_id.as_deref()?;
            let track = gpx_cache.get(gpx_filename)?;
            Some(MapGpxTrack {
                article_id: article.id.to_string(),
                article_title: article.title.clone(),
                polyline: crate::build::gpx::points_to_polyline(
                    &crate::build::gpx::rdp_simplify(&track.points, 0.0003),
                )
                .unwrap_or_default(),
                bbox: MapBbox {
                    min_lat: track.bbox.min_lat,
                    max_lat: track.bbox.max_lat,
                    min_lng: track.bbox.min_lng,
                    max_lng: track.bbox.max_lng,
                },
            })
        })
        .collect();

    let map_memos_out = map_memos_raw
        .iter()
        .map(|m| {
            let image_small_src = m.image_id.as_ref().map(|id| {
                match file_index.get(id) {
                    Some(f) if f.sizes.small.is_some() => format!("/images/{}-small.webp", id),
                    _ => format!("/images/{}-original.webp", id),
                }
            });
            MapMemoOut {
                id: m.id.to_string(),
                kind: m.kind,
                lat: m.lat,
                lng: m.lng,
                memo: m.memo.clone(),
                image_id: m.image_id.as_ref().map(|id| id.to_string()),
                image_small_src,
            }
        })
        .collect();

    MapData {
        gpx_tracks: gpx_tracks_out,
        map_memos: map_memos_out,
    }
}
