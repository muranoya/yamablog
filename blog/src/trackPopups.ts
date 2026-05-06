import L from 'leaflet'
import type { MapGpxTrack } from './types'

export type TrackLayer = {
  track: MapGpxTrack
  latlngs: [number, number][]
  polyline: L.Polyline
}

function distToSegmentPx(p: L.Point, a: L.Point, b: L.Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function isNearPolyline(
  map: L.Map,
  latlng: L.LatLng,
  latlngs: [number, number][],
  thresholdPx = 8,
): boolean {
  const pt = map.latLngToLayerPoint(latlng)
  for (let i = 0; i < latlngs.length - 1; i++) {
    const a = map.latLngToLayerPoint(latlngs[i])
    const b = map.latLngToLayerPoint(latlngs[i + 1])
    if (distToSegmentPx(pt, a, b) <= thresholdPx) return true
  }
  return false
}

export function attachTrackPopups(map: L.Map, trackLayers: TrackLayer[]): void {
  for (const layer of trackLayers) {
    layer.polyline.on('click', (e: L.LeafletMouseEvent) => {
      const clickPt = e.latlng
      const nearby = trackLayers.filter(tl => isNearPolyline(map, clickPt, tl.latlngs))
      if (nearby.length === 0) return

      const popup = document.createElement('div')
      popup.className = 'track-popup'
      if (nearby.length === 1) {
        const a = document.createElement('a')
        a.href = `/articles/${nearby[0].track.article_id}/`
        a.textContent = nearby[0].track.article_title || '記事を見る'
        popup.appendChild(a)
      } else {
        const ul = document.createElement('ul')
        ul.className = 'track-popup-list'
        for (const tl of nearby) {
          const li = document.createElement('li')
          const a = document.createElement('a')
          a.href = `/articles/${tl.track.article_id}/`
          a.textContent = tl.track.article_title || tl.track.article_id
          li.appendChild(a)
          ul.appendChild(li)
        }
        popup.appendChild(ul)
      }
      L.popup({ minWidth: 160 }).setLatLng(clickPt).setContent(popup).openOn(map)
      L.DomEvent.stopPropagation(e)
    })
  }
}
