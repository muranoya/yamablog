use anyhow::Result;
use chrono::{DateTime, FixedOffset};
use geo_types::Coord;

pub struct GpxTrack {
    pub polyline: String,
    pub bbox: BoundingBox,
    pub points: Vec<TrackPoint>,
}

pub struct BoundingBox {
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lng: f64,
    pub max_lng: f64,
}

pub struct TrackPoint {
    pub lat: f64,
    pub lng: f64,
    pub time: Option<DateTime<FixedOffset>>,
}

#[derive(serde::Serialize)]
pub struct PinPoint {
    pub lat: f64,
    pub lng: f64,
    pub datetime: String,
}

pub async fn fetch_and_parse_gpx(url: &str) -> Result<GpxTrack> {
    let body = reqwest::get(url).await?.text().await?;
    parse_gpx_str(&body)
}

pub fn parse_gpx_str(xml: &str) -> Result<GpxTrack> {
    let gpx_data: gpx::Gpx = gpx::read(xml.as_bytes())?;
    let mut points: Vec<TrackPoint> = Vec::new();

    for track in &gpx_data.tracks {
        for segment in &track.segments {
            for pt in &segment.points {
                let lat = pt.point().y();
                let lng = pt.point().x();
                // gpx::Time wraps time::OffsetDateTime; convert via RFC3339 string
                let time = pt.time.and_then(|t| {
                    let s = t.format().ok()?;
                    DateTime::parse_from_rfc3339(&s).ok()
                });
                points.push(TrackPoint { lat, lng, time });
            }
        }
    }

    let bbox = calc_bbox(&points);
    let coords: Vec<Coord<f64>> = points
        .iter()
        .map(|p| Coord { x: p.lng, y: p.lat })
        .collect();
    let polyline_str = polyline::encode_coordinates(coords.into_iter(), 5)?;

    Ok(GpxTrack { polyline: polyline_str, bbox, points })
}

fn calc_bbox(points: &[TrackPoint]) -> BoundingBox {
    if points.is_empty() {
        return BoundingBox { min_lat: 0.0, max_lat: 0.0, min_lng: 0.0, max_lng: 0.0 };
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
    BoundingBox { min_lat, max_lat, min_lng, max_lng }
}

/// Match shooting_datetime list against GPX track points (within ±5 minutes)
pub fn match_pins(
    shooting_datetimes: &[DateTime<FixedOffset>],
    track: &GpxTrack,
) -> Vec<PinPoint> {
    let threshold_secs = 5 * 60_i64;
    let mut pins = Vec::new();

    for shooting_dt in shooting_datetimes {
        let best = track
            .points
            .iter()
            .filter_map(|tp| {
                let tp_time = tp.time?;
                let diff = (*shooting_dt - tp_time).num_seconds().abs();
                if diff <= threshold_secs { Some((diff, tp)) } else { None }
            })
            .min_by_key(|(diff, _)| *diff);

        if let Some((_, tp)) = best {
            pins.push(PinPoint {
                lat: tp.lat,
                lng: tp.lng,
                datetime: shooting_dt.to_rfc3339(),
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
    <trkpt lat="35.360" lon="138.727"><time>2024-08-01T06:00:00Z</time></trkpt>
    <trkpt lat="35.370" lon="138.730"><time>2024-08-01T07:00:00Z</time></trkpt>
    <trkpt lat="35.380" lon="138.735"><time>2024-08-01T08:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>"#;

    #[test]
    fn test_parse_gpx() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        assert_eq!(track.points.len(), 3);
        assert!(!track.polyline.is_empty());
        assert!(track.bbox.min_lat < track.bbox.max_lat);
    }

    #[test]
    fn test_match_pins_within_threshold() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        let dt = DateTime::parse_from_rfc3339("2024-08-01T07:02:00+00:00").unwrap();
        let pins = match_pins(&[dt], &track);
        assert_eq!(pins.len(), 1);
        assert!((pins[0].lat - 35.370).abs() < 0.001);
    }

    #[test]
    fn test_match_pins_outside_threshold() {
        let track = parse_gpx_str(SAMPLE_GPX).unwrap();
        let dt = DateTime::parse_from_rfc3339("2024-08-01T10:00:00+00:00").unwrap();
        let pins = match_pins(&[dt], &track);
        assert_eq!(pins.len(), 0);
    }
}
