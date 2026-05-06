import L from 'leaflet'
import { addTileLayer, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from './mapTiles'
import { decodePolyline } from './polyline'
import { attachTrackPopups } from './trackPopups'
import type { TrackLayer } from './trackPopups'
import type { MapData } from './types'

let sidebarMapData: MapData | null = null

export function getSidebarMapData(): MapData | null {
  return sidebarMapData
}

export async function initSidebarMap(el: HTMLElement, openMapModal: () => void): Promise<void> {
  const url = el.dataset.mapDataUrl
  if (!url) return

  const map = L.map(el, { scrollWheelZoom: false })
  addTileLayer(map)

  let data: MapData
  try {
    data = await fetch(url).then(r => r.json())
    sidebarMapData = data
  } catch {
    map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
    return
  }

  const trackLayers: TrackLayer[] = []

  for (const track of data.gpx_tracks ?? []) {
    if (!track.polyline) continue
    const latlngs = decodePolyline(track.polyline)
    if (latlngs.length === 0) continue
    const pl = L.polyline(latlngs, { color: '#ff3300', weight: 5, opacity: 0.7 }).addTo(map)
    trackLayers.push({ track, latlngs, polyline: pl })
  }

  attachTrackPopups(map, trackLayers)
  map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)

  const expandBtn = document.createElement('button')
  expandBtn.className = 'map-expand-btn'
  expandBtn.setAttribute('aria-label', '地図を拡大表示')
  expandBtn.textContent = '⤢ 拡大'
  el.insertAdjacentElement('afterend', expandBtn)
  expandBtn.addEventListener('click', openMapModal)
}
