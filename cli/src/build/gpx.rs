use anyhow::Result;
use chrono::{DateTime, FixedOffset};
use geo_types::Coord;
use std::path::Path;

pub struct GpxTrack {
    pub bbox: BoundingBox,
    pub points: Vec<TrackPoint>,
}

pub struct BoundingBox {
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lng: f64,
    pub max_lng: f64,
}

#[derive(Clone)]
pub struct TrackPoint {
    pub lat: f64,
    pub lng: f64,
    pub elevation: Option<f64>,
    pub time: Option<DateTime<FixedOffset>>,
}

/// Input to match_pins: one image with its shooting time and metadata.
pub struct ImageInfo {
    pub datetime: DateTime<FixedOffset>,
    pub file_id: String,
    pub description: Option<String>,
}

#[derive(serde::Serialize)]
pub struct PinPoint {
    pub lat: f64,
    pub lng: f64,
    pub file_id: String,
    pub description: Option<String>,
    pub datetime: String,
}

pub fn read_and_parse_gpx(path: &Path) -> Result<GpxTrack> {
    let xml = std::fs::read_to_string(path)?;
    parse_gpx_str(&xml)
}

fn parse_gpx_str(xml: &str) -> Result<GpxTrack> {
    let gpx_data: gpx::Gpx = gpx::read(xml.as_bytes())?;
    let mut points: Vec<TrackPoint> = Vec::new();

    for track in &gpx_data.tracks {
        for segment in &track.segments {
            for pt in &segment.points {
                let lat = pt.point().y();
                let lng = pt.point().x();
                let elevation = pt.elevation;
                // gpx::Time wraps time::OffsetDateTime; convert via RFC3339 string
                let time = pt.time.and_then(|t| {
                    let s = t.format().ok()?;
                    DateTime::parse_from_rfc3339(&s).ok()
                });
                points.push(TrackPoint {
                    lat,
                    lng,
                    elevation,
                    time,
                });
            }
        }
    }

    let bbox = calc_bbox(&points);
    Ok(GpxTrack { bbox, points })
}

/// Encode a slice of track points as a Google Maps Polyline string (precision=5).
pub fn points_to_polyline(points: &[TrackPoint]) -> Result<String> {
    let coords = points.iter().map(|p| Coord { x: p.lng, y: p.lat });
    Ok(polyline::encode_coordinates(coords, 5)?)
}

/// Simplify a polyline using the Ramer-Douglas-Peucker algorithm.
/// `epsilon_deg` is the tolerance in degrees (Euclidean distance on lat/lng).
/// At latitude 35°N: 0.0001° ≈ 11m, 0.0003° ≈ 33m.
pub fn rdp_simplify(points: &[TrackPoint], epsilon_deg: f64) -> Vec<TrackPoint> {
    if points.len() <= 2 {
        return points.to_vec();
    }
    let start = &points[0];
    let end = &points[points.len() - 1];
    let (max_idx, max_dist) = points[1..points.len() - 1]
        .iter()
        .enumerate()
        .map(|(i, p)| (i + 1, perp_dist(p, start, end)))
        .fold(
            (0, 0.0_f64),
            |(mi, md), (i, d)| if d > md { (i, d) } else { (mi, md) },
        );
    if max_dist > epsilon_deg {
        let mut left = rdp_simplify(&points[..=max_idx], epsilon_deg);
        let right = rdp_simplify(&points[max_idx..], epsilon_deg);
        left.pop();
        left.extend(right);
        left
    } else {
        vec![points[0].clone(), points[points.len() - 1].clone()]
    }
}

fn perp_dist(p: &TrackPoint, start: &TrackPoint, end: &TrackPoint) -> f64 {
    let dx = end.lng - start.lng;
    let dy = end.lat - start.lat;
    if dx == 0.0 && dy == 0.0 {
        return ((p.lng - start.lng).powi(2) + (p.lat - start.lat).powi(2)).sqrt();
    }
    let t = ((p.lng - start.lng) * dx + (p.lat - start.lat) * dy) / (dx * dx + dy * dy);
    let cx = start.lng + t * dx;
    let cy = start.lat + t * dy;
    ((p.lng - cx).powi(2) + (p.lat - cy).powi(2)).sqrt()
}

fn calc_bbox(points: &[TrackPoint]) -> BoundingBox {
    if points.is_empty() {
        return BoundingBox {
            min_lat: 0.0,
            max_lat: 0.0,
            min_lng: 0.0,
            max_lng: 0.0,
        };
    }
    let mut min_lat = f64::INFINITY;
    let mut max_lat = f64::NEG_INFINITY;
    let mut min_lng = f64::INFINITY;
    let mut max_lng = f64::NEG_INFINITY;
    for p in points {
        min_lat = min_lat.min(p.lat);
        max_lat = max_lat.max(p.lat);
        min_lng = min_lng.min(p.lng);
        max_lng = max_lng.max(p.lng);
    }
    BoundingBox {
        min_lat,
        max_lat,
        min_lng,
        max_lng,
    }
}

/// Haversine distance in meters between two lat/lng points.
fn haversine_m(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6_371_000.0_f64;
    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);
    r * 2.0 * a.sqrt().asin()
}

/// Returns (cumulative_distances_m, elevations_m) from track points.
/// Points without elevation are skipped.
pub fn calc_elevation_profile(points: &[TrackPoint]) -> (Vec<f64>, Vec<f64>) {
    let mut distances = Vec::new();
    let mut elevations = Vec::new();
    let mut cumulative = 0.0_f64;
    let mut prev: Option<&TrackPoint> = None;
    for p in points {
        if let Some(elev) = p.elevation {
            if let Some(pp) = prev {
                cumulative += haversine_m(pp.lat, pp.lng, p.lat, p.lng);
            }
            distances.push((cumulative * 10.0).round() / 10.0);
            elevations.push((elev * 10.0).round() / 10.0);
            prev = Some(p);
        }
    }
    (distances, elevations)
}

/// Match image info list against GPX track points (within ±5 minutes)
pub fn match_pins(images: &[ImageInfo], track: &GpxTrack) -> Vec<PinPoint> {
    let threshold_secs = 5 * 60_i64;
    let mut pins = Vec::new();

    for img in images {
        let best = track
            .points
            .iter()
            .filter_map(|tp| {
                let tp_time = tp.time?;
                let diff = (img.datetime - tp_time).num_seconds().abs();
                if diff <= threshold_secs {
                    Some((diff, tp))
                } else {
                    None
                }
            })
            .min_by_key(|(diff, _)| *diff);

        if let Some((_, tp)) = best {
            pins.push(PinPoint {
                lat: tp.lat,
                lng: tp.lng,
                file_id: img.file_id.clone(),
                description: img.description.clone(),
                datetime: img.datetime.to_rfc3339(),
            });
        }
    }
    pins
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_GPX: &str = r#"<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="35.360" lon="138.727"><ele>1500.0</ele><time>2024-08-01T06:00:00Z</time></trkpt>
    <trkpt lat="35.370" lon="138.730"><ele>1800.0</ele><time>2024-08-01T07:00:00Z</time></trkpt>
    <trkpt lat="35.380" lon="138.735"><ele>2000.0</ele><time>2024-08-01T08:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>"#;

    #[test]
    fn test_parse_gpx() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        assert_eq!(track.points.len(), 3);
        assert!(track.bbox.min_lat < track.bbox.max_lat);
        assert_eq!(track.points[0].elevation, Some(1500.0));
        assert_eq!(track.points[1].elevation, Some(1800.0));
    }

    #[test]
    fn test_points_to_polyline() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        let pl = points_to_polyline(&track.points).unwrap();
        assert!(!pl.is_empty());
    }

    #[test]
    fn test_rdp_simplify_collinear() {
        // 直線上の中間点は epsilon が十分大きければ削除される
        let points = vec![
            TrackPoint {
                lat: 35.0,
                lng: 138.0,
                elevation: None,
                time: None,
            },
            TrackPoint {
                lat: 35.5,
                lng: 138.5,
                elevation: None,
                time: None,
            },
            TrackPoint {
                lat: 36.0,
                lng: 139.0,
                elevation: None,
                time: None,
            },
        ];
        let simplified = rdp_simplify(&points, 0.0001);
        assert_eq!(simplified.len(), 2, "直線上の中間点は削除されるべき");
        assert!((simplified[0].lat - 35.0).abs() < 1e-9);
        assert!((simplified[1].lat - 36.0).abs() < 1e-9);
    }

    #[test]
    fn test_rdp_simplify_preserves_bend() {
        // 大きく折れ曲がった頂点は保持される
        let points = vec![
            TrackPoint {
                lat: 35.0,
                lng: 138.0,
                elevation: None,
                time: None,
            },
            TrackPoint {
                lat: 35.5,
                lng: 139.0,
                elevation: None,
                time: None,
            }, // 大きく外れた点
            TrackPoint {
                lat: 35.0,
                lng: 140.0,
                elevation: None,
                time: None,
            },
        ];
        let simplified = rdp_simplify(&points, 0.0001);
        assert_eq!(simplified.len(), 3, "折れ曲がりの頂点は保持されるべき");
    }

    #[test]
    fn test_calc_elevation_profile() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        let (distances, elevations) = calc_elevation_profile(&track.points);
        assert_eq!(distances.len(), 3);
        assert_eq!(elevations.len(), 3);
        assert_eq!(distances[0], 0.0);
        assert!(distances[1] > 0.0);
        assert!(distances[2] > distances[1]);
        assert_eq!(elevations[0], 1500.0);
        assert_eq!(elevations[2], 2000.0);
    }

    #[test]
    fn test_match_pins_within_threshold() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        let img = ImageInfo {
            datetime: DateTime::parse_from_rfc3339("2024-08-01T07:02:00+00:00").unwrap(),
            file_id: "test-uuid".to_string(),
            description: Some("テスト画像".to_string()),
        };
        let pins = match_pins(&[img], &track);
        assert_eq!(pins.len(), 1);
        assert!((pins[0].lat - 35.370).abs() < 0.001);
        assert_eq!(pins[0].file_id, "test-uuid");
    }

    #[test]
    fn test_match_pins_outside_threshold() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        let img = ImageInfo {
            datetime: DateTime::parse_from_rfc3339("2024-08-01T10:00:00+00:00").unwrap(),
            file_id: "test-uuid-2".to_string(),
            description: None,
        };
        let pins = match_pins(&[img], &track);
        assert_eq!(pins.len(), 0);
    }
}
