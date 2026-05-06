// Google Maps encoded polyline decoder, precision=5.
export function decodePolyline(encoded: string): [number, number][] {
  const result: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let resultVal = 0
    let b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      resultVal |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += (resultVal & 1) ? ~(resultVal >> 1) : resultVal >> 1

    shift = 0
    resultVal = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      resultVal |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += (resultVal & 1) ? ~(resultVal >> 1) : resultVal >> 1

    result.push([lat / 1e5, lng / 1e5])
  }
  return result
}
