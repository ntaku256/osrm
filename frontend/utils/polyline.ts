/**
 * Standard Polyline algorithm implementation
 * Supports both precision 5 (Google) and precision 6 (Valhalla)
 */

export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  const factor = Math.pow(10, precision)

  while (index < encoded.length) {
    // Decode latitude
    let byte: number
    let shift = 0
    let result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += deltaLat

    // Decode longitude
    shift = 0
    result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += deltaLng

    coordinates.push([lat / factor, lng / factor])
  }

  return coordinates
}

export function testDecodeWithBothPrecisions(encoded: string): {
  precision5: [number, number][]
  precision6: [number, number][]
} {
  return {
    precision5: decodePolyline(encoded, 5),
    precision6: decodePolyline(encoded, 6)
  }
} 