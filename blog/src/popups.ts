import L from 'leaflet'
import { memoIcon, memoKindName } from './pinIcons'
import type { MapMemo, PinPoint } from './types'

export function buildCameraPopup(pin: PinPoint): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pin-popup'

  const img = document.createElement('img')
  img.src = pin.small_src
  img.alt = pin.description ?? ''
  img.className = 'pin-popup-thumb'
  img.dataset.lightboxSrc = `/images/${pin.file_id}-original.webp`
  el.appendChild(img)

  if (pin.description) {
    const cap = document.createElement('p')
    cap.className = 'pin-popup-caption'
    cap.textContent = pin.description
    el.appendChild(cap)
  }

  const dt = document.createElement('p')
  dt.className = 'pin-popup-datetime'
  try {
    const d = new Date(pin.datetime)
    const fmt = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    dt.textContent = `撮影日時: ${fmt}`
  } catch {
    dt.textContent = pin.datetime
  }
  el.appendChild(dt)

  return el
}

export function buildMemoPopup(memo: MapMemo): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pin-popup'

  const kindLabel = document.createElement('p')
  kindLabel.className = 'pin-popup-kind'
  kindLabel.textContent = memoKindName(memo.kind)
  el.appendChild(kindLabel)

  if (memo.image_small_src) {
    const img = document.createElement('img')
    img.src = memo.image_small_src
    img.alt = memo.memo
    img.className = 'pin-popup-thumb'
    img.dataset.lightboxSrc = memo.image_id ? `/images/${memo.image_id}-original.webp` : memo.image_small_src
    el.appendChild(img)
  }

  const text = document.createElement('p')
  text.className = 'pin-popup-memo'
  text.textContent = memo.memo
  el.appendChild(text)

  return el
}

export function createMemoMarker(memo: MapMemo): L.Marker {
  return L.marker([memo.lat, memo.lng], {
    icon: memoIcon(memo.kind),
  }).bindPopup(buildMemoPopup(memo), { minWidth: 220 })
}
