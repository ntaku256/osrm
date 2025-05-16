// OSRM APIとの連携を行うユーティリティ関数

// OSRMのベースURL
const OSRM_BASE_URL = "https://router.project-osrm.org"

// API呼び出しのタイムアウト時間（ミリ秒）
const API_TIMEOUT_MS = 5000

// リトライの最大回数
const MAX_RETRIES = 2

// リトライ間の待機時間（ミリ秒）
const RETRY_DELAY_MS = 1000

export interface OSRMNearestResponse {
  waypoints: Array<{
    nodes: number[]
    distance: number
    location: [number, number]
    name: string
  }>
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
