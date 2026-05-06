export interface MapGpxTrack {
  article_id: string
  article_title: string
  polyline: string
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }
}

export interface MapData {
  gpx_tracks: MapGpxTrack[]
  map_memos: unknown[]
}

export interface PinPoint {
  lat: number
  lng: number
  file_id: string
  description?: string
  datetime: string
  small_src: string
}

export interface BboxData {
  min_lat: number
  max_lat: number
  min_lng: number
  max_lng: number
}

export interface GpxStats {
  elapsed_seconds: number | null
  distance_m: number
  cum_climb_m: number
  cum_down_m: number
  max_elevation_m: number
  min_elevation_m: number
}

export interface MapMemo {
  kind: number
  lat: number
  lng: number
  memo: string
  image_id?: string
  image_small_src?: string
}
