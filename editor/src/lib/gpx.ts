export interface GpxStats {
  start_at: string | null;
  end_at: string | null;
  distance_m: number;
  cum_climb_m: number;
  cum_down_m: number;
  max_elevation_m: number;
  min_elevation_m: number;
}

interface TrackPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: string | null;
}

export function parseGpxStats(xml: string): GpxStats {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  const trkpts = Array.from(doc.querySelectorAll("trkpt"));
  if (trkpts.length === 0) {
    return { start_at: null, end_at: null, distance_m: 0, cum_climb_m: 0, cum_down_m: 0, max_elevation_m: 0, min_elevation_m: 0 };
  }

  const points: TrackPoint[] = trkpts.map((pt) => ({
    lat: parseFloat(pt.getAttribute("lat") ?? "0"),
    lon: parseFloat(pt.getAttribute("lon") ?? "0"),
    ele: pt.querySelector("ele") ? parseFloat(pt.querySelector("ele")!.textContent!) : null,
    time: pt.querySelector("time")?.textContent ?? null,
  }));

  let distance_m = 0;
  let cum_climb_m = 0;
  let cum_down_m = 0;
  const elevations = points.map((p) => p.ele).filter((e): e is number => e !== null);

  for (let i = 1; i < points.length; i++) {
    distance_m += haversineM(points[i - 1], points[i]);
    if (points[i].ele !== null && points[i - 1].ele !== null) {
      const diff = points[i].ele! - points[i - 1].ele!;
      if (diff > 0) cum_climb_m += diff;
      else cum_down_m += Math.abs(diff);
    }
  }

  return {
    start_at: points[0].time,
    end_at: points[points.length - 1].time,
    distance_m: Math.round(distance_m),
    cum_climb_m: Math.round(cum_climb_m),
    cum_down_m: Math.round(cum_down_m),
    max_elevation_m: elevations.length ? Math.max(...elevations) : 0,
    min_elevation_m: elevations.length ? Math.min(...elevations) : 0,
  };
}

function haversineM(a: TrackPoint, b: TrackPoint): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
