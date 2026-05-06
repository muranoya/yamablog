import L from 'leaflet'

const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'
const TILE_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>'

export const DEFAULT_MAP_CENTER: [number, number] = [35.9087, 139.2259]
export const DEFAULT_MAP_ZOOM = 11

export function addTileLayer(map: L.Map): void {
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map)
}
