import './style.css'
import L from 'leaflet'
import uPlot from 'uplot'
import 'leaflet/dist/leaflet.css'
import 'uplot/dist/uPlot.min.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapGpxTrack {
  article_id: string
  article_title: string
  polyline: string
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }
}

interface MapData {
  gpx_tracks: MapGpxTrack[]
  map_memos: unknown[]
}

interface PinPoint {
  lat: number
  lng: number
  file_id: string
  description?: string
  datetime: string
}

interface BboxData {
  min_lat: number
  max_lat: number
  min_lng: number
  max_lng: number
}

interface GpxStats {
  elapsed_seconds: number | null
  distance_m: number
  cum_climb_m: number
  cum_down_m: number
  max_elevation_m: number
  min_elevation_m: number
}

interface MapMemo {
  kind: number
  lat: number
  lng: number
  memo: string
  image_id?: string
}

// ---------------------------------------------------------------------------
// Polyline decoder (Google Maps format, precision=5)
// ---------------------------------------------------------------------------

function decodePolyline(encoded: string): [number, number][] {
  const result: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result_val = 0
    let b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      result_val |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += (result_val & 1) ? ~(result_val >> 1) : result_val >> 1

    shift = 0
    result_val = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result_val |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += (result_val & 1) ? ~(result_val >> 1) : result_val >> 1

    result.push([lat / 1e5, lng / 1e5])
  }
  return result
}

// ---------------------------------------------------------------------------
// Shared Leaflet config
// ---------------------------------------------------------------------------

const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'
const TILE_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>'

function addTileLayer(map: L.Map): void {
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map)
}

// ---------------------------------------------------------------------------
// Pin icon helpers — CSS teardrop + SVG (ported from trail-behind-them)
// ---------------------------------------------------------------------------

function createPinIcon(svgIcon: string, markerColor: string, iconColor: string): L.DivIcon {
  const html = `<div style="background-color:${markerColor};border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:35px;height:35px;box-shadow:-1px 1px 4px rgba(0,0,0,.3);position:relative"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:20px;height:20px;color:${iconColor};font-size:20px;display:flex;align-items:center;justify-content:center">${svgIcon}</div></div>`
  return L.divIcon({
    html,
    className: 'pin-icon',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  })
}

// SVG icon strings indexed by map memo kind
const MEMO_KIND_SVG: Record<number, string> = {
  0:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="1em" width="1em"><path d="M256 32c12.5 0 24.1 6.4 30.8 17l216.6 345.4c5.6 8.9 8.6 19.2 8.6 29.7 0 30.9-25 55.9-55.9 55.9H55.9C25 480 0 455 0 424.1c0-10.5 3-20.8 8.6-29.7L225.2 49c6.6-10.6 18.3-17 30.8-17zm65 192-65-103.6-79.1 126.1 18.3 24.4c6.4 8.5 19.2 8.5 25.6 0l25.6-34.1c6-8.1 15.5-12.8 25.6-12.8h49z"/></svg>',
  1:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="1em" width="1em"><path d="M512 96c0 50.2-59.1 125.1-84.6 155-3.8 4.4-9.4 6.1-14.5 5H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c53 0 96 43 96 96s-43 96-96 96H139.6c8.7-9.9 19.3-22.6 30-36.8 6.3-8.4 12.8-17.6 19-27.2H416c17.7 0 32-14.3 32-32s-14.3-32-32-32h-96c-53 0-96-43-96-96s43-96 96-96h39.8c-21-31.5-39.8-67.7-39.8-96 0-53 43-96 96-96s96 43 96 96zM117.1 489.1c-3.8 4.3-7.2 8.1-10.1 11.3l-1.8 2-.2-.2c-6 4.6-14.6 4-20-1.8C59.8 473 0 402.5 0 352c0-53 43-96 96-96s96 43 96 96c0 30-21.1 67-43.5 97.9-10.7 14.7-21.7 28-30.8 38.5l-.6.7zM128 352a32 32 0 1 0-64 0 32 32 0 1 0 64 0zm288-224a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>',
  2:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="1em" width="1em"><path d="M11.94 2a2.99 2.99 0 0 1 2.45 1.279l.108.164 8.431 14.074a2.989 2.989 0 0 1-2.366 4.474l-.2.009H3.362a2.99 2.99 0 0 1-2.648-4.308l.101-.189 8.425-14.065A2.989 2.989 0 0 1 11.94 2zm.07 14-.127.007a1 1 0 0 0 0 1.986l.117.007.127-.007a1 1 0 0 0 0-1.986l-.117-.007zm-.01-8a1 1 0 0 0-.993.883L11 9v4l.007.117a1 1 0 0 0 1.986 0L13 13V9l-.007-.117A1 1 0 0 0 12 8z"/></svg>',
  3:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" height="1em" width="1em"><path d="m252.4 103.8 27 48c2.8 5 8.2 8.2 13.9 8.2h53.3c5.8 0 11.1-3.1 13.9-8.2l27-48c2.7-4.9 2.7-10.8 0-15.7l-27-48c-2.8-5-8.2-8.2-13.9-8.2h-53.2c-5.8 0-11.1 3.1-13.9 8.2l-27 48c-2.7 4.9-2.7 10.8 0 15.7zM68.3 87C43.1 61.8 0 79.7 0 115.3V432c0 44.2 35.8 80 80 80h316.7c35.6 0 53.5-43.1 28.3-68.3L68.3 87zm435.9 316.6c4.9 2.7 10.8 2.7 15.7 0l48-27c5-2.8 8.2-8.2 8.2-13.9v-53.3c0-5.8-3.1-11.1-8.2-13.9l-48-27c-4.9-2.7-10.8-2.7-15.7 0l-48 27c-5 2.8-8.2 8.2-8.2 13.9v53.3c0 5.8 3.1 11.1 8.2 13.9l48 27zM192 64a32 32 0 1 0-64 0 32 32 0 1 0 64 0zm192 224a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>',
  4:   '<svg fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="1em" width="1em" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4v-4h4v-4h4v-4h4"/><path d="M4 11l7-7v4m-4-4h4"/></svg>',
  6:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="1em" width="1em"><path d="M265.12 60.12a12 12 0 0 0-18.23 0C215.23 97.15 112 225.17 112 320c0 88.37 55.64 144 144 144s144-55.63 144-144c0-94.83-103.23-222.85-134.88-259.88ZM272 412a12 12 0 0 1-11.34-16 11.89 11.89 0 0 1 11.41-8A60.06 60.06 0 0 0 332 328.07a11.89 11.89 0 0 1 8-11.41A12 12 0 0 1 356 328a84.09 84.09 0 0 1-84 84Z"/></svg>',
  7:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" height="1em" width="1em"><path d="M269.5 69.9c11.1-7.9 25.9-7.9 37 0C329 85.4 356.5 96 384 96c26.9 0 55.4-10.8 77.4-26.1 11.9-8.5 28.1-7.8 39.2 1.7 14.4 11.9 32.5 21 50.6 25.2 17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25-29 15.6-61.5 25.9-94.5 25.9-31.9 0-60.6-9.9-80.4-18.9-5.8-2.7-11.1-5.3-15.6-7.7-4.5 2.4-9.7 5.1-15.6 7.7-19.8 9-48.5 18.9-80.4 18.9-33 0-65.5-10.3-94.5-25.8-13.4 8.4-33.7 19.3-58.2 25-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18-4.3 36.2-13.4 50.5-25.3 11.1-9.5 27.3-10.1 39.2-1.7C136.7 85.2 165.1 96 192 96c27.5 0 55-10.6 77.5-26.1zm37 288c22.5 15.5 50 26.1 77.5 26.1 26.9 0 55.4-10.8 77.4-26.1 11.9-8.5 28.1-7.8 39.2 1.7 14.4 11.9 32.5 21 50.6 25.2 17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25-29 15.6-61.5 25.9-94.5 25.9-31.9 0-60.6-9.9-80.4-18.9-5.8-2.7-11.1-5.3-15.6-7.7-4.5 2.4-9.7 5.1-15.6 7.7-19.8 9-48.5 18.9-80.4 18.9-33 0-65.5-10.3-94.5-25.8-13.4 8.4-33.7 19.3-58.2 25-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2 11.1-9.4 27.3-10.1 39.2-1.7 22.1 15.2 50.5 26 77.4 26 27.5 0 55-10.6 77.5-26.1 11.1-7.9 25.9-7.9 37 0zm0-144c22.5 15.5 50 26.1 77.5 26.1 26.9 0 55.4-10.8 77.4-26.1 11.9-8.5 28.1-7.8 39.2 1.7 14.4 11.9 32.5 21 50.6 25.2 17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25-29 15.6-61.5 25.9-94.5 25.9-31.9 0-60.6-9.9-80.4-18.9-5.8-2.7-11.1-5.3-15.6-7.7-4.5 2.4-9.7 5.1-15.6 7.7-19.8 9-48.5 18.9-80.4 18.9-33 0-65.5-10.3-94.5-25.8-13.4 8.4-33.7 19.3-58.2 25-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2 11.1-9.5 27.3-10.1 39.2-1.7 22.1 15.2 50.5 26 77.4 26 27.5 0 55-10.6 77.5-26.1 11.1-7.9 25.9-7.9 37 0z"/></svg>',
  8:   '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" height="1em" width="1em"><path d="M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32v448c0 17.7 14.3 32 32 32s32-14.3 32-32V352l64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4 44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30V66.1c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0-35.1-17.6-75.4-22-113.5-12.5L64 48V32z"/></svg>',
  9:   '<svg fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="1em" width="1em" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 6a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-3"/><path d="M3 5h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H3"/><path d="M17 7v4a2 2 0 1 0 4 0V7a2 2 0 1 0-4 0z"/><path d="M3 16c0 1.657 4.03 3 9 3s9-1.343 9-3"/></svg>',
  101: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" height="1em" width="1em"><path d="M543.8 287.6c17 0 32-14 32-32.1 1-9-3-17-11-24L512 185V64c0-17.7-14.3-32-32-32h-32c-17.7 0-32 14.3-32 32v36.7L309.5 7c-6-5-14-7-21-7s-15 1-22 8L10 231.5c-7 7-10 15-10 24 0 18 14 32.1 32 32.1h32V448c0 35.3 28.7 64 64 64h320.5c35.5 0 64.2-28.8 64-64.3l-.7-160.2h32zM288 160a64 64 0 1 1 0 128 64 64 0 1 1 0-128zM176 400c0-44.2 35.8-80 80-80h64c44.2 0 80 35.8 80 80 0 8.8-7.2 16-16 16H192c-8.8 0-16-7.2-16-16z"/></svg>',
  102: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" height="1em" width="1em"><path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c.2 35.5-28.5 64.3-64 64.3H128.1c-35.3 0-64-28.7-64-64V287.6H32c-18 0-32-14-32-32.1 0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L416 100.7V64c0-17.7 14.3-32 32-32h32c17.7 0 32 14.3 32 32v121l52.8 46.4c8 7 12 15 11 24zM272 192c-8.8 0-16 7.2-16 16v48h-48c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h48v48c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16v-48h48c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16h-48v-48c0-8.8-7.2-16-16-16h-32z"/></svg>',
  103: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="1em" width="1em"><path fill="currentColor" d="M21 2v20h-2v-8h-3V7a5 5 0 0 1 5-5ZM9 13.9V22H7v-8.1A5.002 5.002 0 0 1 3 9V3h2v7h2V3h2v7h2V3h2v6a5.002 5.002 0 0 1-4 4.9Z"/></svg>',
  104: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="1em" width="1em"><path fill="currentColor" d="M11 6v8h8a8 8 0 1 1-16 0c0-4.335 3.58-8 8-8Zm10-4v2l-5.327 6H21v2h-8v-2l5.326-6H13V2h8Z"/></svg>',
  105: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" height="1em" width="1em"><path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c.2 35.5-28.5 64.3-64 64.3H326.4L288 448l80.8-67.3c7.8-6.5 7.6-18.6-.4-24.9l-117.8-92.6c-14.6-11.5-33.8 7-22.8 22L288 368l-85.5 71.2c-6.1 5-7.5 13.8-3.5 20.5l31.4 52.3H128.1c-35.3 0-64-28.7-64-64V287.6H32c-18 0-32-14-32-32.1 0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L416 100.7V64c0-17.7 14.3-32 32-32h32c17.7 0 32 14.3 32 32v121l52.8 46.4c8 7 12 15 11 24z"/></svg>',
  106: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" height="1em" width="1em"><path d="M80 48a48 48 0 1 1 96 0 48 48 0 1 1-96 0zm40 304v128c0 17.7-14.3 32-32 32s-32-14.3-32-32V325.2c-8.1 9.2-21.1 13.2-33.5 9.4-16.9-5.3-26.3-23.2-21-40.1l30.9-99.1C44.9 155.3 82 128 124 128h8c42 0 79.1 27.3 91.6 67.4l30.9 99.1c5.3 16.9-4.1 34.8-21 40.1-12.4 3.9-25.4-.2-33.5-9.4V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V352h-16zM320 0c13.3 0 24 10.7 24 24v464c0 13.3-10.7 24-24 24s-24-10.7-24-24V24c0-13.3 10.7-24 24-24zm144 48a48 48 0 1 1 96 0 48 48 0 1 1-96 0zm-24 432v-96h-17.8c-10.9 0-18.6-10.7-15.2-21.1l9-26.9c-3.2 0-6.4-.5-9.5-1.5-16.9-5.3-26.3-23.2-21-40.1l29.7-95.2c13.2-42.3 52.4-71.2 96.8-71.2s83.6 28.9 96.8 71.2l29.7 95.2c5.3 16.9-4.1 34.8-21 40.1-3.2 1-6.4 1.5-9.5 1.5l9 26.9c3.5 10.4-4.3 21.1-15.2 21.1H584v96c0 17.7-14.3 32-32 32s-32-14.3-32-32v-96h-16v96c0 17.7-14.3 32-32 32s-32-14.3-32-32z"/></svg>',
  107: '<svg fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="1em" width="1em" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M18 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M10 5h7c2.761 0 5 3.134 5 7v5h-2"/><path d="M16 17H8"/><path d="M16 5l1.5 7h4.5"/><path d="M9.5 10h7.5"/><path d="M12 5v5"/><path d="M5 9v11"/></svg>',
  108: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" height="1em" width="1em"><path d="M96 0C43 0 0 43 0 96v256c0 48 35.2 87.7 81.1 94.9l-46 46c-7 7-2 19.1 7.9 19.1h39.7c8.5 0 16.6-3.4 22.6-9.4L160 448h128l54.6 54.6c6 6 14.1 9.4 22.6 9.4H405c10 0 15-12.1 7.9-19.1l-46-46c46-7.1 81.1-46.9 81.1-94.9V96c0-53-43-96-96-96H96zM64 128c0-17.7 14.3-32 32-32h80c17.7 0 32 14.3 32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32v-96zm208-32h80c17.7 0 32 14.3 32 32v96c0 17.7-14.3 32-32 32h-80c-17.7 0-32-14.3-32-32v-96c0-17.7 14.3-32 32-32zM64 352a32 32 0 1 1 64 0 32 32 0 1 1-64 0zm288-32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>',
  109: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="1em" width="1em"><path d="M248 0h16c13.3 0 24 10.7 24 24v10.7c80.4 13.4 143.9 76.9 157.3 157.3h2.7c17.7 0 32 14.3 32 32s-14.3 32-32 32H64c-17.7 0-32-14.3-32-32s14.3-32 32-32h2.7C80.1 111.6 143.6 48.1 224 34.7V24c0-13.3 10.7-24 24-24zM64 288h64v128h40V288h64v128h48V288h64v128h40V288h64v132.3c.6.3 1.2.7 1.7 1.1l48 32c11.7 7.8 17 22.4 12.9 35.9S494.1 512 480 512H32c-14.1 0-26.5-9.2-30.6-22.7s1.1-28.1 12.9-35.9l48-32c.6-.4 1.2-.7 1.8-1.1V288z"/></svg>',
  110: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="1em" width="1em"><path d="M248 0h16c13.3 0 24 10.7 24 24v10.7c80.4 13.4 143.9 76.9 157.3 157.3h2.7c17.7 0 32 14.3 32 32s-14.3 32-32 32H64c-17.7 0-32-14.3-32-32s14.3-32 32-32h2.7C80.1 111.6 143.6 48.1 224 34.7V24c0-13.3 10.7-24 24-24zM64 288h64v128h40V288h64v128h48V288h64v128h40V288h64v132.3c.6.3 1.2.7 1.7 1.1l48 32c11.7 7.8 17 22.4 12.9 35.9S494.1 512 480 512H32c-14.1 0-26.5-9.2-30.6-22.7s1.1-28.1 12.9-35.9l48-32c.6-.4 1.2-.7 1.8-1.1V288z"/></svg>',
}

const MEMO_KIND_COLOR: Record<number, [string, string]> = {
  // [markerColor, iconColor]
  0: ['#5f9ea0', 'white'], 1: ['#5f9ea0', 'white'],
  2: ['red', 'white'],     3: ['red', 'white'],     4: ['red', 'white'],
  6: ['#1a6fc4', 'white'], 7: ['#1a6fc4', 'white'],
  8: ['#5f9ea0', 'white'], 9: ['#5f9ea0', 'white'],
  101: ['#4B0150', 'white'], 102: ['#4B0150', 'white'], 103: ['#4B0150', 'white'],
  104: ['#4B0150', 'white'], 105: ['#4B0150', 'white'], 106: ['#4B0150', 'white'],
  107: ['orange', 'black'],  108: ['orange', 'black'],
  109: ['#4B0150', 'white'], 110: ['#4B0150', 'white'],
}

const MEMO_KIND_NAME: Record<number, string> = {
  0: '山頂', 1: '峠', 2: '注意箇所', 3: '岩場', 4: '急登',
  6: '水場', 7: '滝', 8: 'ランドマーク', 9: '眺望',
  101: '山小屋(宿泊可)', 102: '避難小屋', 103: '茶屋(宿泊不可)',
  104: '東屋', 105: '廃屋', 106: 'トイレ',
  107: 'バス停', 108: '駅', 109: 'お寺', 110: '神社',
}

// Default fallback SVG (question mark circle)
const DEFAULT_PIN_SVG = '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="1em" width="1em"><path d="M464 256a208 208 0 1 0-416 0 208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0 256 256 0 1 1-512 0zm169.8-90.7c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1 0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6-13.3 0-24-10.7-24-24v-13.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1 0-8.4-6.8-15.1-15.1-15.1h-58.3c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1-64 0z"/></svg>'

// Camera SVG icon (matching old getCameraPinIcon)
const CAMERA_SVG = '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" height="1em" width="1em"><path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/></svg>'

function memoKindName(kind: number): string {
  return MEMO_KIND_NAME[kind] ?? 'ピン'
}

function memoIcon(kind: number): L.DivIcon {
  const svg = MEMO_KIND_SVG[kind] ?? DEFAULT_PIN_SVG
  const [mc, ic] = MEMO_KIND_COLOR[kind] ?? ['#888', 'white']
  return createPinIcon(svg, mc, ic)
}

function cameraIcon(): L.DivIcon {
  return createPinIcon(CAMERA_SVG, '#5192E8', 'black')
}

// ---------------------------------------------------------------------------
// Popup builders (DOM API only — no innerHTML with user data)
// ---------------------------------------------------------------------------

function buildCameraPopup(pin: PinPoint): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pin-popup'

  const img = document.createElement('img')
  img.src = `/images/${pin.file_id}-small.webp`
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

function buildMemoPopup(memo: MapMemo): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pin-popup'

  const kindLabel = document.createElement('p')
  kindLabel.className = 'pin-popup-kind'
  kindLabel.textContent = memoKindName(memo.kind)
  el.appendChild(kindLabel)

  if (memo.image_id) {
    const img = document.createElement('img')
    img.src = `/images/${memo.image_id}-small.webp`
    img.alt = memo.memo
    img.className = 'pin-popup-thumb'
    img.dataset.lightboxSrc = `/images/${memo.image_id}-original.webp`
    el.appendChild(img)
  }

  const text = document.createElement('p')
  text.className = 'pin-popup-memo'
  text.textContent = memo.memo
  el.appendChild(text)

  return el
}

function createMemoMarker(memo: MapMemo): L.Marker {
  return L.marker([memo.lat, memo.lng], {
    icon: memoIcon(memo.kind),
  }).bindPopup(buildMemoPopup(memo), { minWidth: 220 })
}

// ---------------------------------------------------------------------------
// Stats formatting
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}時間${m}分` : `${m}分`
}

function formatDistance(m: number): string {
  return (m / 1000).toFixed(2) + 'km'
}

function renderStats(stats: GpxStats): HTMLElement {
  const el = document.createElement('div')
  el.className = 'gpx-stats'

  const row1 = document.createElement('div')
  row1.className = 'gpx-stats-row'

  if (stats.elapsed_seconds != null) {
    const t = document.createElement('span')
    t.className = 'gpx-stat'
    const label = document.createElement('span')
    label.className = 'gpx-stat-label'
    label.textContent = '時間'
    const val = document.createElement('span')
    val.className = 'gpx-stat-value'
    val.textContent = formatElapsed(stats.elapsed_seconds)
    t.appendChild(label)
    t.appendChild(val)
    row1.appendChild(t)
  }

  const dist = document.createElement('span')
  dist.className = 'gpx-stat'
  const distLabel = document.createElement('span')
  distLabel.className = 'gpx-stat-label'
  distLabel.textContent = '距離'
  const distVal = document.createElement('span')
  distVal.className = 'gpx-stat-value'
  distVal.textContent = formatDistance(stats.distance_m)
  dist.appendChild(distLabel)
  dist.appendChild(distVal)
  row1.appendChild(dist)
  el.appendChild(row1)

  const row2 = document.createElement('div')
  row2.className = 'gpx-stats-row'

  const statDefs: [string, number, string][] = [
    ['累積登り', stats.cum_climb_m, 'm'],
    ['累積下り', stats.cum_down_m, 'm'],
    ['最大標高', stats.max_elevation_m, 'm'],
    ['最低標高', stats.min_elevation_m, 'm'],
  ]
  for (const [label, value, unit] of statDefs) {
    const s = document.createElement('span')
    s.className = 'gpx-stat'
    const l = document.createElement('span')
    l.className = 'gpx-stat-label'
    l.textContent = label
    const v = document.createElement('span')
    v.className = 'gpx-stat-value'
    v.textContent = Math.round(value) + unit
    s.appendChild(l)
    s.appendChild(v)
    row2.appendChild(s)
  }
  el.appendChild(row2)

  return el
}

// ---------------------------------------------------------------------------
// Polyline proximity helpers (used by sidebar map)
// ---------------------------------------------------------------------------

function distToSegmentPx(p: L.Point, a: L.Point, b: L.Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
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

// ---------------------------------------------------------------------------
// Feature 1: Sidebar GPX map
// ---------------------------------------------------------------------------

let _sidebarMapData: MapData | null = null
let _modalMap: L.Map | null = null
let _modalInitialized = false
let _openMapModal: (() => void) | null = null
function openMapModal(): void { _openMapModal?.() }

type TrackLayer = { track: MapGpxTrack; latlngs: [number, number][]; polyline: L.Polyline }

function attachTrackPopups(map: L.Map, trackLayers: TrackLayer[]): void {
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

async function initSidebarMap(el: HTMLElement): Promise<void> {
  const url = el.dataset.mapDataUrl
  if (!url) return

  const map = L.map(el, { scrollWheelZoom: false })
  addTileLayer(map)

  let data: MapData
  try {
    data = await fetch(url).then(r => r.json())
    _sidebarMapData = data
  } catch {
    map.setView([35.9087, 139.2259], 11)
    return
  }

  let allBounds: L.LatLngBounds | null = null
  const trackLayers: TrackLayer[] = []

  for (const track of data.gpx_tracks ?? []) {
    if (!track.polyline) continue
    const latlngs = decodePolyline(track.polyline)
    if (latlngs.length === 0) continue
    const pl = L.polyline(latlngs, { color: '#ff3300', weight: 5, opacity: 0.7 }).addTo(map)
    trackLayers.push({ track, latlngs, polyline: pl })
    allBounds = allBounds ? allBounds.extend(pl.getBounds()) : pl.getBounds()
  }

  attachTrackPopups(map, trackLayers)

  map.setView([35.9087, 139.2259], 11)

  const expandBtn = document.createElement('button')
  expandBtn.className = 'map-expand-btn'
  expandBtn.setAttribute('aria-label', '地図を拡大表示')
  expandBtn.textContent = '⤢ 拡大'
  el.insertAdjacentElement('afterend', expandBtn)
  expandBtn.addEventListener('click', () => openMapModal())
}

// ---------------------------------------------------------------------------
// Feature 1b: Map expand modal
// ---------------------------------------------------------------------------

function initMapModal(): void {
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

    if (!_modalInitialized) {
      _modalInitialized = true
      _modalMap = L.map(mapEl, { scrollWheelZoom: true })
      addTileLayer(_modalMap)

      if (_sidebarMapData) {
        let allBounds: L.LatLngBounds | null = null
        const modalTrackLayers: TrackLayer[] = []
        for (const track of _sidebarMapData.gpx_tracks ?? []) {
          if (!track.polyline) continue
          const latlngs = decodePolyline(track.polyline)
          if (latlngs.length === 0) continue
          const pl = L.polyline(latlngs, { color: '#ff3300', weight: 5, opacity: 0.8 }).addTo(_modalMap)
          modalTrackLayers.push({ track, latlngs, polyline: pl })
          allBounds = allBounds ? allBounds.extend(pl.getBounds()) : pl.getBounds()
        }
        attachTrackPopups(_modalMap, modalTrackLayers)
        if (allBounds) {
          _modalMap.fitBounds(allBounds, { padding: [20, 20] })
        } else {
          _modalMap.setView([35.9087, 139.2259], 11)
        }
      } else {
        _modalMap.setView([35.9087, 139.2259], 11)
      }
    }

    requestAnimationFrame(() => { _modalMap?.invalidateSize() })
  }

  function close(): void {
    overlay.classList.remove('active')
    document.body.style.overflow = ''
  }

  _openMapModal = open

  backdrop.addEventListener('click', close)
  closeBtn.addEventListener('click', close)
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('active')) return
    if (e.key === 'Escape') close()
  })
}

// ---------------------------------------------------------------------------
// Feature 2a: Article GPX map
// ---------------------------------------------------------------------------

function initArticleGpxMap(el: HTMLElement): void {
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

  // Camera pin layer
  const pinLayer = L.layerGroup()
  for (const pin of pins) {
    L.marker([pin.lat, pin.lng], { icon: cameraIcon() })
      .bindPopup(buildCameraPopup(pin))
      .addTo(pinLayer)
  }
  pinLayer.addTo(map)

  // Map memo layer
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

  // Insert controls (checkboxes) after the map div
  const controls = document.createElement('div')
  controls.className = 'gpx-controls'

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

  controls.appendChild(makeCheckbox('撮影ピンを表示', true, show => {
    if (show) { pinLayer.addTo(map) } else { map.removeLayer(pinLayer) }
  }))
  controls.appendChild(makeCheckbox('マップメモピンを表示', true, show => {
    if (show) { memoLayer.addTo(map) } else { map.removeLayer(memoLayer) }
  }))

  el.insertAdjacentElement('afterend', controls)

  // Insert stats after controls
  if (stats) {
    const statsEl = renderStats(stats)
    controls.insertAdjacentElement('afterend', statsEl)
  }
}

// ---------------------------------------------------------------------------
// Feature 2b: Elevation chart
// ---------------------------------------------------------------------------

function initElevationChart(el: HTMLElement): void {
  const dJson = el.dataset.distances
  const eJson = el.dataset.elevations
  if (!dJson || !eJson) return

  const distances: number[] = JSON.parse(dJson)
  const elevations: number[] = JSON.parse(eJson)
  if (distances.length === 0) return

  const width = el.clientWidth || 600

  new uPlot(
    {
      width,
      height: 200,
      series: [
        { label: '距離(m)' },
        {
          label: '標高(m)',
          stroke: '#2d6a4f',
          fill: 'rgba(45,106,79,0.15)',
          width: 1.5,
        },
      ],
      axes: [
        { label: '距離 (m)' },
        { label: '標高 (m)' },
      ],
      scales: {
        x: { time: false },
      },
      cursor: {
        drag: { x: false, y: false },
      },
    },
    [distances, elevations],
    el,
  )
}

// ---------------------------------------------------------------------------
// Feature 3: Lightbox
// ---------------------------------------------------------------------------

function initLightbox(): void {
  const triggers = Array.from(
    document.querySelectorAll<HTMLImageElement>('img.lightbox-trigger'),
  )
  if (triggers.length === 0) return

  // Build overlay using DOM API
  const overlay = document.createElement('div')
  overlay.id = 'lightbox'

  const backdrop = document.createElement('div')
  backdrop.className = 'lb-backdrop'

  // Fitted view: image with object-fit:contain
  const lbImg = document.createElement('img')
  lbImg.className = 'lb-img'
  lbImg.alt = ''

  // Original size view: scrollable container
  const lbScroll = document.createElement('div')
  lbScroll.className = 'lb-scroll'
  const lbImgOrig = document.createElement('img')
  lbImgOrig.className = 'lb-img-orig'
  lbImgOrig.alt = ''
  lbScroll.appendChild(lbImgOrig)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'lb-close'
  closeBtn.setAttribute('aria-label', '閉じる')
  closeBtn.textContent = '×'

  const zoomBtn = document.createElement('button')
  zoomBtn.className = 'lb-zoom'
  zoomBtn.setAttribute('aria-label', '原寸表示')
  zoomBtn.textContent = '⊕'

  const prevBtn = document.createElement('button')
  prevBtn.className = 'lb-prev'
  prevBtn.setAttribute('aria-label', '前の画像')
  prevBtn.textContent = '‹'

  const nextBtn = document.createElement('button')
  nextBtn.className = 'lb-next'
  nextBtn.setAttribute('aria-label', '次の画像')
  nextBtn.textContent = '›'

  overlay.appendChild(backdrop)
  overlay.appendChild(closeBtn)
  overlay.appendChild(zoomBtn)
  overlay.appendChild(prevBtn)
  overlay.appendChild(lbImg)
  overlay.appendChild(lbScroll)
  overlay.appendChild(nextBtn)
  document.body.appendChild(overlay)

  let currentIdx = 0
  let isZoomed = false

  // Drag-to-scroll for original-size view
  let dragActive = false
  let dragStartX = 0
  let dragStartY = 0
  let dragScrollLeft = 0
  let dragScrollTop = 0

  lbScroll.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    dragActive = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragScrollLeft = lbScroll.scrollLeft
    dragScrollTop = lbScroll.scrollTop
    lbScroll.style.cursor = 'grabbing'
    e.preventDefault()
  })
  document.addEventListener('mousemove', e => {
    if (!dragActive) return
    lbScroll.scrollLeft = dragScrollLeft - (e.clientX - dragStartX)
    lbScroll.scrollTop = dragScrollTop - (e.clientY - dragStartY)
  })
  document.addEventListener('mouseup', () => {
    if (!dragActive) return
    dragActive = false
    lbScroll.style.cursor = 'grab'
  })

  function setMode(zoomed: boolean): void {
    isZoomed = zoomed
    lbImg.style.display = zoomed ? 'none' : 'block'
    lbScroll.style.display = zoomed ? 'block' : 'none'
    zoomBtn.textContent = zoomed ? '⊖' : '⊕'
    zoomBtn.setAttribute('aria-label', zoomed ? '画面に合わせる' : '原寸表示')
  }

  function show(idx: number): void {
    currentIdx = idx
    const src = triggers[idx].dataset.originalSrc ?? triggers[idx].src
    const alt = triggers[idx].alt
    lbImg.src = src
    lbImg.alt = alt
    lbImgOrig.src = src
    lbImgOrig.alt = alt
    setMode(false)
    overlay.classList.add('active')
    document.body.style.overflow = 'hidden'
    prevBtn.style.visibility = idx > 0 ? 'visible' : 'hidden'
    nextBtn.style.visibility = idx < triggers.length - 1 ? 'visible' : 'hidden'
  }

  function close(): void {
    overlay.classList.remove('active')
    document.body.style.overflow = ''
  }

  triggers.forEach((t, i) => t.addEventListener('click', () => show(i)))
  backdrop.addEventListener('click', close)
  closeBtn.addEventListener('click', close)
  zoomBtn.addEventListener('click', () => setMode(!isZoomed))
  prevBtn.addEventListener('click', () => {
    if (currentIdx > 0) show(currentIdx - 1)
  })
  nextBtn.addEventListener('click', () => {
    if (currentIdx < triggers.length - 1) show(currentIdx + 1)
  })
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('active')) return
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowLeft' && currentIdx > 0) show(currentIdx - 1)
    if (e.key === 'ArrowRight' && currentIdx < triggers.length - 1) show(currentIdx + 1)
  })

  // Show a single image by src (no prev/next navigation — used from map popups)
  function showSrc(src: string, alt: string): void {
    lbImg.src = src
    lbImg.alt = alt
    lbImgOrig.src = src
    lbImgOrig.alt = alt
    setMode(false)
    overlay.classList.add('active')
    document.body.style.overflow = 'hidden'
    prevBtn.style.visibility = 'hidden'
    nextBtn.style.visibility = 'hidden'
    currentIdx = -1
  }

  // Event delegation: clicks on popup thumbnails (dynamically created by Leaflet)
  document.addEventListener('click', e => {
    const t = e.target
    if (!(t instanceof HTMLImageElement) || !t.classList.contains('pin-popup-thumb')) return
    const src = t.dataset.lightboxSrc ?? t.src
    showSrc(src, t.alt)
  })
}

// ---------------------------------------------------------------------------
// Feature 4: Scroll-to-top button (article pages only)
// ---------------------------------------------------------------------------

function initScrollToTop(): void {
  if (!document.querySelector('article')) return

  const btn = document.createElement('button')
  btn.id = 'scroll-to-top'
  btn.setAttribute('aria-label', 'ページトップへ戻る')
  btn.textContent = '↑'
  document.body.appendChild(btn)

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400)
  }, { passive: true })

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const sidebarMap = document.querySelector<HTMLElement>('#gpx-map[data-map-data-url]')
  if (sidebarMap) {
    initMapModal()
    initSidebarMap(sidebarMap)
  }

  document
    .querySelectorAll<HTMLElement>('.gpx-map[data-polyline]')
    .forEach(initArticleGpxMap)

  document
    .querySelectorAll<HTMLElement>('.elevation-chart[data-distances]')
    .forEach(initElevationChart)

  initLightbox()
  initScrollToTop()
})
