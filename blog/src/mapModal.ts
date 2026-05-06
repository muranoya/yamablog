import L from 'leaflet'
import { addTileLayer, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from './mapTiles'
import { decodePolyline } from './polyline'
import { attachTrackPopups } from './trackPopups'
import type { TrackLayer } from './trackPopups'
import type { MapData } from './types'

export function initMapModal(getMapData: () => MapData | null): () => void {
  let modalMap: L.Map | null = null
  let modalInitialized = false

  const overlay = document.createElement('div')
  overlay.id = 'map-modal'

  const backdrop = document.createElement('div')
  backdrop.className = 'map-modal-backdrop'

  const content = document.createElement('div')
  content.className = 'map-modal-content'

  const mapEl = document.createElement('div')
  mapEl.className = 'map-modal-map'
  content.appendChild(mapEl)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'map-modal-close'
  closeBtn.setAttribute('aria-label', '閉じる')
  closeBtn.textContent = '×'

  overlay.appendChild(backdrop)
  overlay.appendChild(content)
  overlay.appendChild(closeBtn)
  document.body.appendChild(overlay)

  function open(): void {
    overlay.classList.add('active')
    document.body.style.overflow = 'hidden'

    if (!modalInitialized) {
      modalInitialized = true
      modalMap = L.map(mapEl, { scrollWheelZoom: true })
      addTileLayer(modalMap)

      const mapData = getMapData()
      if (mapData) {
        let allBounds: L.LatLngBounds | null = null
        const modalTrackLayers: TrackLayer[] = []
        for (const track of mapData.gpx_tracks ?? []) {
          if (!track.polyline) continue
          const latlngs = decodePolyline(track.polyline)
          if (latlngs.length === 0) continue
          const pl = L.polyline(latlngs, { color: '#ff3300', weight: 5, opacity: 0.8 }).addTo(modalMap)
          modalTrackLayers.push({ track, latlngs, polyline: pl })
          allBounds = allBounds ? allBounds.extend(pl.getBounds()) : pl.getBounds()
        }
        attachTrackPopups(modalMap, modalTrackLayers)
        if (allBounds) {
          modalMap.fitBounds(allBounds, { padding: [20, 20] })
        } else {
          modalMap.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
        }
      } else {
        modalMap.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
      }
    }

    requestAnimationFrame(() => { modalMap?.invalidateSize() })
  }

  function close(): void {
    overlay.classList.remove('active')
    document.body.style.overflow = ''
  }

  backdrop.addEventListener('click', close)
  closeBtn.addEventListener('click', close)
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('active')) return
    if (e.key === 'Escape') close()
  })

  return open
}
