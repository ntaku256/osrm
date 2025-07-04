// OSRM APIとの連携を行うユーティリティ関数

// OSRMのベースURL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

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
 * Valhallaカスタムエンジンの/locateエンドポイントを使って最寄り道路情報を取得する
 * @param position [緯度, 経度]
 */
export async function getNearestRoad(position: [number, number]): Promise<any | null> {
  try {
    // Valhalla locate APIのリクエスト仕様に合わせてbodyを作成
    const body = {
      locations: [
        {
          lat: position[0],
          lon: position[1],
        },
      ],
      costing: 'pedestrian',
    };

    const response = await fetch(`${API_BASE_URL}/locate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend /api/locate API error: ${response.statusText}`);
    }

    const data = await response.json();
    // Valhalla locateのレスポンスからway_idを抽出
    let way_id: number | undefined = undefined;
    let nodes: [number, number] = [0, 0];
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].edges)) {
      if (data[0].edges.length > 0) {
        way_id = data[0].edges[0].way_id;
        nodes = [data[0].edges[0].way_id, 0];
      }
    }
    return { ...data[0], way_id, nodes };
  } catch (error) {
    console.error('Failed to fetch nearest road from backend /api/locate:', error);
    return null;
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
