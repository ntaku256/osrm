// OSRM APIとの連携を行うユーティリティ関数

// OSRMのベースURL
const OSRM_BASE_URL = "https://router.project-osrm.org"

// API呼び出しのタイムアウト時間（ミリ秒）
const API_TIMEOUT_MS = 5000

// リトライの最大回数
const MAX_RETRIES = 2

// リトライ間の待機時間（ミリ秒）
const RETRY_DELAY_MS = 1000

export interface OSRMRoute {
  routeId: string
  geometry: string // Polyline encoded geometry
  distance: number
  duration: number
  legs: any[]
}

export interface OSRMRouteResponse {
  routes: OSRMRoute[]
  waypoints: any[]
}

export interface OSRMNearestResponse {
  waypoints: Array<{
    nodes: number[]
    distance: number
    location: [number, number]
    name: string
  }>
}

export interface OSRMTableResponse {
  durations: number[][]
  sources: Array<{
    location: [number, number]
    name?: string
  }>
  destinations: Array<{
    location: [number, number]
    name?: string
  }>
}

export interface OSRMIntersection {
  id: string
  location: [number, number]
  name?: string
}

export interface OSRMRoadSegment {
  id: string
  startIntersection: OSRMIntersection
  endIntersection: OSRMIntersection
  geometry: string
  distance: number
  duration: number
  name?: string
}

/**
 * APIリクエストに失敗した場合のフォールバック: 中心を通る4方向のルートを生成
 * @param center 中心点 [緯度, 経度]
 * @param radius 半径（度単位）
 */
function createFallbackRoutes(center: [number, number], radius: number): OSRMRoadSegment[] {
  console.log("Using fallback route generation")
  const directions = [
    { name: "north-south", angle: 0 },
    { name: "east-west", angle: 90 },
    { name: "ne-sw", angle: 45 },
    { name: "nw-se", angle: 135 }
  ]
  
  return directions.map(dir => {
    const rad1 = (dir.angle * Math.PI) / 180
    const rad2 = ((dir.angle + 180) * Math.PI) / 180
    
    const start: OSRMIntersection = {
      id: `fallback-${dir.name}-start`,
      location: [
        center[0] + Math.cos(rad1) * radius * 0.7,
        center[1] + Math.sin(rad1) * radius * 0.7
      ],
      name: `${dir.name} 始点`
    }
    
    const end: OSRMIntersection = {
      id: `fallback-${dir.name}-end`,
      location: [
        center[0] + Math.cos(rad2) * radius * 0.7,
        center[1] + Math.sin(rad2) * radius * 0.7
      ],
      name: `${dir.name} 終点`
    }
    
    // 単純な直線のジオメトリを作成（エンコードされたポリライン形式）
    const encodedGeometry = encodeSimplePolyline([start.location, end.location])
    
    return {
      id: `segment-${start.id}-${end.id}`,
      startIntersection: start,
      endIntersection: end,
      geometry: encodedGeometry,
      distance: calculateDistance(start.location, end.location),
      duration: 60, // 仮の所要時間（秒）
      name: dir.name
    }
  })
}

/**
 * 指定した地点周辺の全ての道路区間（交差点間のリンク）を取得する
 * @param center 中心点 [緯度, 経度]
 * @param radius 半径（度単位）
 */
export async function getRoutesAroundPoint(
  center: [number, number],
  radius = 0.01,
): Promise<{ routes: OSRMRoadSegment[]; error?: string }> {
  try {
    // 1. 範囲内の交差点を取得
    let intersections: OSRMIntersection[] = []
    try {
      intersections = await getIntersectionsInArea(center, radius)
      
      if (intersections.length === 0) {
        console.warn("No intersections found, using fallback routes")
        return { routes: createFallbackRoutes(center, radius) }
      }
      
      console.log(`Found ${intersections.length} intersections in the area`)
    } catch (error) {
      console.error("Failed to get intersections, using fallback routes:", error)
      return { routes: createFallbackRoutes(center, radius) }
    }
    
    // 2. 交差点間の道路区間（リンク）を取得
    try {
      const roadSegments = await getRoadSegmentsBetweenIntersections(intersections)
      
      if (roadSegments.length === 0) {
        console.warn("No road segments found, using fallback routes")
        return { routes: createFallbackRoutes(center, radius) }
      }
      
      return { routes: roadSegments }
    } catch (error) {
      console.error("Failed to get road segments, using fallback routes:", error)
      return { routes: createFallbackRoutes(center, radius) }
    }
  } catch (error) {
    console.error("Failed to fetch routes around point:", error)
    return { routes: createFallbackRoutes(center, radius), error: "経路の取得に失敗しました" }
  }
}

/**
 * 指定した範囲内の交差点を取得する
 * @param center 中心点 [緯度, 経度]
 * @param radius 半径（度単位）
 */
async function getIntersectionsInArea(
  center: [number, number], 
  radius: number
): Promise<OSRMIntersection[]> {
  try {
    // 範囲の四隅を計算
    const north = center[0] + radius
    const south = center[0] - radius
    const east = center[1] + radius
    const west = center[1] - radius
    
    // グリッドサイズを縮小してAPI呼び出し回数を削減
    const gridSize = 3 // 3x3グリッド
    const stepLat = (north - south) / gridSize
    const stepLng = (east - west) / gridSize
    
    const samplePoints: [number, number][] = []
    
    // 格子点を生成
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const lat = south + stepLat * i
        const lng = west + stepLng * j
        samplePoints.push([lat, lng])
      }
    }
    
    // 中心点も追加
    samplePoints.push(center)
    
    // 各サンプル点の最寄りの道路を取得（リクエストを直列化して負荷を減らす）
    const nearestRoads = []
    for (const point of samplePoints) {
      try {
        const road = await getNearestRoad(point)
        if (road) {
          nearestRoads.push(road)
        }
        // 連続リクエストの間に少し待機
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.warn(`Failed to get nearest road for point ${point}: ${error}`)
        // エラーが発生しても続行
        continue
      }
    }
    
    // 有効な道路点だけを抽出
    const validRoadPoints = nearestRoads
      .map(road => ({
        id: `intersection-${road.nodes.join('-')}`,
        location: road.location as [number, number],
        name: road.name || "名称なし"
      }))
    
    // 重複を除去（位置が非常に近い点は同じ交差点とみなす）
    const uniqueIntersections: OSRMIntersection[] = []
    const threshold = 0.0001 // 約10メートルの誤差範囲
    
    for (const point of validRoadPoints) {
      // 既存の交差点と距離を比較
      const isDuplicate = uniqueIntersections.some(existing => {
        const latDiff = Math.abs(existing.location[0] - point.location[0])
        const lngDiff = Math.abs(existing.location[1] - point.location[1])
        return latDiff < threshold && lngDiff < threshold
      })
      
      if (!isDuplicate) {
        uniqueIntersections.push(point)
      }
    }
    
    return uniqueIntersections
  } catch (error) {
    console.error("Failed to get intersections in area:", error)
    return []
  }
}

/**
 * 交差点間の道路区間（リンク）を取得する
 * @param intersections 交差点の配列
 */
async function getRoadSegmentsBetweenIntersections(
  intersections: OSRMIntersection[]
): Promise<OSRMRoadSegment[]> {
  const roadSegments: OSRMRoadSegment[] = []
  
  // 交差点ペアの組み合わせを作成し、その間の道路区間を取得
  // 全ての組み合わせをチェックすると効率が悪いため、
  // 各交差点から最も近い数個の交差点のみをチェック
  const MAX_NEIGHBORS = 3 // 近隣交差点の数を減らして呼び出し回数を削減
  
  // 多すぎる交差点がある場合は制限
  const MAX_INTERSECTIONS = 6
  const limitedIntersections = intersections.length > MAX_INTERSECTIONS
    ? intersections.slice(0, MAX_INTERSECTIONS)
    : intersections
  
  for (let i = 0; i < limitedIntersections.length; i++) {
    const startIntersection = limitedIntersections[i]
    
    // 他の交差点との距離を計算
    const neighbors = limitedIntersections
      .filter((_, index) => index !== i)
      .map(endIntersection => {
        const latDiff = endIntersection.location[0] - startIntersection.location[0]
        const lngDiff = endIntersection.location[1] - startIntersection.location[1]
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
        return { endIntersection, distance }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_NEIGHBORS)
    
    // 各近隣交差点への道路区間を取得（リクエストを直列化）
    for (const { endIntersection } of neighbors) {
      try {
        // 既存の道路区間と重複していないかチェック
        const segmentId = `segment-${startIntersection.id}-${endIntersection.id}`
        const reverseSegmentId = `segment-${endIntersection.id}-${startIntersection.id}`
        
        const isDuplicate = roadSegments.some(
          segment => segment.id === segmentId || segment.id === reverseSegmentId
        )
        
        if (!isDuplicate) {
          const route = await getRoute(
            startIntersection.location,
            endIntersection.location
          )
          
          if (route && route.routes && route.routes.length > 0) {
            const routeData = route.routes[0]
            
            roadSegments.push({
              id: segmentId,
              startIntersection,
              endIntersection,
              geometry: routeData.geometry,
              distance: routeData.distance,
              duration: routeData.duration,
              name: route.waypoints[0].name || undefined
            })
          }
        }
        
        // 連続リクエストの間に少し待機
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.warn(`Failed to get route between intersections: ${error}`)
        // エラーが発生しても続行
        continue
      }
    }
  }
  
  // 道路区間が取得できなかった場合は、直線で結んだ道路区間を生成
  if (roadSegments.length === 0) {
    console.warn("No road segments fetched from API, creating straight line segments")
    
    for (let i = 0; i < limitedIntersections.length; i++) {
      const startIntersection = limitedIntersections[i]
      
      const neighbors = limitedIntersections
        .filter((_, index) => index !== i)
        .map(endIntersection => {
          const latDiff = endIntersection.location[0] - startIntersection.location[0]
          const lngDiff = endIntersection.location[1] - startIntersection.location[1]
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
          return { endIntersection, distance }
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_NEIGHBORS)
      
      for (const { endIntersection, distance } of neighbors) {
        const segmentId = `segment-${startIntersection.id}-${endIntersection.id}`
        const reverseSegmentId = `segment-${endIntersection.id}-${startIntersection.id}`
        
        const isDuplicate = roadSegments.some(
          segment => segment.id === segmentId || segment.id === reverseSegmentId
        )
        
        if (!isDuplicate) {
          // 単純な直線のジオメトリを作成
          const encodedGeometry = encodeSimplePolyline([
            startIntersection.location,
            endIntersection.location
          ])
          
          roadSegments.push({
            id: segmentId,
            startIntersection,
            endIntersection,
            geometry: encodedGeometry,
            distance: calculateDistance(startIntersection.location, endIntersection.location),
            duration: distance * 60, // 仮の所要時間（秒）
            name: "直線経路"
          })
        }
      }
    }
  }
  
  return roadSegments
}

/**
 * fetchリクエストをタイムアウトとリトライ機能付きで実行する
 * @param url リクエストURL
 * @param options fetchオプション
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // タイムアウト処理の追加
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * リトライ機能付きのfetch
 * @param url リクエストURL
 * @param options fetchオプション
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} for ${url}`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
      
      return await fetchWithTimeout(url, options)
    } catch (error) {
      console.warn(`Fetch attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for ${url}:`, error)
      lastError = error as Error
    }
  }
  
  throw lastError || new Error(`Failed to fetch ${url} after ${MAX_RETRIES} retries`)
}

/**
 * 2点間の経路を取得する
 * @param start 開始地点の[緯度, 経度]
 * @param end 終了地点の[緯度, 経度]
 */
export async function getRoute(start: [number, number], end: [number, number]): Promise<OSRMRouteResponse | null> {
  try {
    // 緯度・経度の順序に注意: OSRM APIは[経度, 緯度]の順序を期待する
    const url = `${OSRM_BASE_URL}/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=polyline`

    console.log("Fetching route from OSRM:", url)
    const response = await fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Failed to fetch route from OSRM:", error)
    return null
  }
}

/**
 * 指定した地点の最寄りの道路を取得する
 * @param position [緯度, 経度]
 */
export async function getNearestRoad(position: [number, number]): Promise<any | null> {
  try {
    // 緯度・経度の順序に注意: OSRM APIは[経度, 緯度]の順序を期待する
    const url = `${OSRM_BASE_URL}/nearest/v1/driving/${position[1]},${position[0]}?number=1`

    console.log("Fetching nearest road from OSRM:", url)
    const response = await fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.statusText}`)
    }

    const data = (await response.json()) as OSRMNearestResponse
    console.log("OSRM nearest response:", data)

    if (data.waypoints && data.waypoints.length > 0) {
      const waypoint = data.waypoints[0]
      return {
        nodes: waypoint.nodes || [],
        name: waypoint.name || "名称なし",
        distance: waypoint.distance,
        location: [waypoint.location[1], waypoint.location[0]], // [lat, lng]の順に変換
      }
    }

    return null
  } catch (error) {
    console.error("Failed to fetch nearest road from OSRM:", error)
    return null
  }
}

/**
 * 2点間の距離を計算する（ヒュベニの公式、単位: メートル）
 */
function calculateDistance(point1: [number, number], point2: [number, number]): number {
  const [lat1, lng1] = point1
  const [lat2, lng2] = point2
  
  // ラジアンに変換
  const radLat1 = (lat1 * Math.PI) / 180
  const radLng1 = (lng1 * Math.PI) / 180
  const radLat2 = (lat2 * Math.PI) / 180
  const radLng2 = (lng2 * Math.PI) / 180
  
  // 地球の半径（メートル）
  const EARTH_RADIUS = 6371000
  
  // 緯度差
  const dLat = radLat2 - radLat1
  // 経度差
  const dLng = radLng2 - radLng1
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(radLat1) * Math.cos(radLat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  // 距離（メートル）
  return EARTH_RADIUS * c
}

/**
 * 単純な直線のポリラインを生成してエンコードする
 * Google Maps APIのポリラインアルゴリズムと互換性のある簡略版
 */
function encodeSimplePolyline(points: [number, number][]): string {
  if (!points || points.length === 0) {
    return ""
  }
  
  let result = ""
  let prevLat = 0
  let prevLng = 0
  
  for (const [lat, lng] of points) {
    // 緯度と経度を5桁の精度に変換
    const latE5 = Math.round(lat * 1e5)
    const lngE5 = Math.round(lng * 1e5)
    
    // 前の点からの差分
    const dLat = latE5 - prevLat
    const dLng = lngE5 - prevLng
    
    // 差分をエンコード
    result += encodeNumber(dLat) + encodeNumber(dLng)
    
    prevLat = latE5
    prevLng = lngE5
  }
  
  return result
}

/**
 * ポリライン用の数値エンコード（Googleのアルゴリズム）
 */
function encodeNumber(num: number): string {
  // 符号反転ビットを追加（奇数の場合は負の値）
  let value = num < 0 ? ~(num << 1) : (num << 1)
  let result = ""
  
  // 5ビットごとにエンコード
  while (value >= 0x20) {
    result += String.fromCharCode(0x20 | (value & 0x1f) | 0x20)
    value >>= 5
  }
  
  result += String.fromCharCode(value | 0x20)
  return result
}

/**
 * Google Maps APIのポリラインアルゴリズムでエンコードされた文字列をデコードする
 * @param encoded エンコードされたポリライン文字列
 * @returns デコードされた座標の配列 [lat, lng]
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || typeof encoded !== "string") {
    console.warn("Invalid polyline:", encoded)
    return []
  }

  try {
    // JSONフォーマットの場合はパースを試みる
    if (encoded.startsWith("[") && encoded.endsWith("]")) {
      const parsed = JSON.parse(encoded)
      console.log("Successfully parsed JSON polyline:", parsed.length, "points")
      return parsed
    }

    // 標準的なポリラインデコード（Google Maps APIのアルゴリズム）
    const poly: [number, number][] = []
    let index = 0
    let lat = 0
    let lng = 0

    while (index < encoded.length) {
      let b
      let shift = 0
      let result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
      lat += dlat

      shift = 0
      result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
      lng += dlng

      poly.push([lat * 1e-5, lng * 1e-5])
    }

    console.log("Decoded standard polyline:", poly.length, "points")
    return poly
  } catch (error) {
    console.error("Error decoding polyline:", error, "Raw polyline:", encoded)
    return []
  }
}
