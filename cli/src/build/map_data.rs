use serde::Serialize;
use crate::build::gpx::{BoundingBox, GpxTrack};

#[derive(Serialize)]
pub struct MapData {
    pub gpx_tracks: Vec<MapGpxTrack>,
    pub map_memos: Vec<MapMemoOut>,
}

#[derive(Serialize)]
pub struct MapGpxTrack {
    pub article_id: String,
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

pub fn build_map_data(
    map_memos_raw: &[crate::schema::manifest::ManifestMapMemosItem],
    gpx_tracks: &[(String, GpxTrack)],
) -> MapData {
    let gpx_tracks_out = gpx_tracks
        .iter()
        .map(|(article_id, track)| MapGpxTrack {
            article_id: article_id.clone(),
            polyline: track.polyline.clone(),
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

    MapData { gpx_tracks: gpx_tracks_out, map_memos: map_memos_out }
}
