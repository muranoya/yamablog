import L from 'leaflet'
import { addTileLayer } from './mapTiles'
import { cameraIcon } from './pinIcons'
import { decodePolyline } from './polyline'
import { buildCameraPopup, createMemoMarker } from './popups'
import { renderStats } from './stats'
import type { BboxData, GpxStats, MapMemo, PinPoint } from './types'

function makeCheckbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrapper = document.createElement('label')
  wrapper.className = 'gpx-checkbox-label'
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = checked
  cb.addEventListener('change', () => onChange(cb.checked))
  const span = document.createElement('span')
  span.textContent = label
  wrapper.appendChild(cb)
  wrapper.appendChild(span)
  return wrapper
}

export function initArticleGpxMap(el: HTMLElement): void {
  const polylineStr = el.dataset.polyline
  if (!polylineStr) return

  const pins: PinPoint[] = JSON.parse(el.dataset.pins || '[]')
  const bbox: Partial<BboxData> = JSON.parse(el.dataset.bbox || '{}')
  const memos: MapMemo[] = JSON.parse(el.dataset.mapMemos || '[]')
  const statsRaw = el.dataset.stats
  const stats: GpxStats | null = statsRaw ? JSON.parse(statsRaw) : null

  const map = L.map(el, { scrollWheelZoom: false })
  addTileLayer(map)

  const latlngs = decodePolyline(polylineStr)
  if (latlngs.length > 0) {
    L.polyline(latlngs, { color: '#ff3300', weight: 4, opacity: 0.8 }).addTo(map)
    L.circleMarker(latlngs[0], { radius: 8, color: '#fff', weight: 2, fillColor: '#00BF00', fillOpacity: 1 })
      .bindPopup('スタート').addTo(map)
    L.circleMarker(latlngs[latlngs.length - 1], { radius: 8, color: '#fff', weight: 2, fillColor: '#ED2B00', fillOpacity: 1 })
      .bindPopup('ゴール').addTo(map)
  }

  const pinLayer = L.layerGroup()
  for (const pin of pins) {
    L.marker([pin.lat, pin.lng], { icon: cameraIcon() })
      .bindPopup(buildCameraPopup(pin))
      .addTo(pinLayer)
  }
  pinLayer.addTo(map)

  const memoLayer = L.layerGroup()
  for (const memo of memos) {
    createMemoMarker(memo).addTo(memoLayer)
  }
  memoLayer.addTo(map)

  if (
    bbox.min_lat != null &&
    bbox.max_lat != null &&
    bbox.min_lng != null &&
    bbox.max_lng != null
  ) {
    map.fitBounds(
      [[bbox.min_lat, bbox.min_lng], [bbox.max_lat, bbox.max_lng]],
      { padding: [30, 30] },
    )
  } else if (latlngs.length > 0) {
    map.fitBounds(L.polyline(latlngs).getBounds(), { padding: [30, 30] })
  }

  const controls = document.createElement('div')
  controls.className = 'gpx-controls'

  controls.appendChild(makeCheckbox('撮影ピンを表示', true, show => {
    if (show) { pinLayer.addTo(map) } else { map.removeLayer(pinLayer) }
  }))
  controls.appendChild(makeCheckbox('マップメモピンを表示', true, show => {
    if (show) { memoLayer.addTo(map) } else { map.removeLayer(memoLayer) }
  }))

  el.insertAdjacentElement('afterend', controls)

  if (stats) {
    const statsEl = renderStats(stats)
    controls.insertAdjacentElement('afterend', statsEl)
  }
}
