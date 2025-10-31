"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { apiFetch } from "@/lib/api"
import { useBackendUser } from "@/hooks/useBackendUser"
import { decodePolyline } from "@/utils/polyline";
const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false })

interface WalkedRoute {
  id: string
  title: string
  start_time: string
  end_time: string
  distance: number
  created_at: string
  trace_raw: { lat: number, lon: number }[]
  duration: number;
  obstacles?: any[];
  route_summary?: any;
  shape?: string;
}

export default function RecordListPage() {
  const { user, loading: userLoading } = useBackendUser();
  const [routes, setRoutes] = useState<WalkedRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setRoutes([])
      setLoading(false)
      return;
    }
    const fetchRoutes = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await apiFetch("/walked_routes")
        if (!res.ok) throw new Error("記録の取得に失敗しました")
        const data = await res.json()
        setRoutes(data)
        if (data.length > 0) setSelectedId(data[0].id)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchRoutes()
  }, [user, userLoading])

  const selectedRoute = routes.find(r => r.id === selectedId) || null
  const shapePoints = selectedRoute?.shape ? decodePolyline(selectedRoute.shape, 6) : [];
  // obstaclesのdangerLevel等を型に合わせて変換
  const obstacles = Array.isArray(selectedRoute?.obstacles)
    ? selectedRoute.obstacles.map(o => ({
        ...o,
        dangerLevel: o.danger_level ?? o.dangerLevel,
        createdAt: o.created_at ?? o.createdAt,
      }))
    : [];
  // summaryのフィールド名もRouteSummary型に合わせる
  const summary: import("@/types/route").RouteSummary = selectedRoute?.route_summary
    ? {
        has_time_restrictions: selectedRoute.route_summary.has_time_restrictions,
        has_toll: selectedRoute.route_summary.has_toll,
        has_highway: selectedRoute.route_summary.has_highway,
        has_ferry: selectedRoute.route_summary.has_ferry,
        min_lat: selectedRoute.route_summary.min_lat,
        min_lon: selectedRoute.route_summary.min_lon,
        max_lat: selectedRoute.route_summary.max_lat,
        max_lon: selectedRoute.route_summary.max_lon,
        time: selectedRoute.route_summary.time,
        length: selectedRoute.route_summary.length,
        cost: selectedRoute.route_summary.cost,
      }
    : {
        has_time_restrictions: false,
        has_toll: false,
        has_highway: false,
        has_ferry: false,
        min_lat: 0,
        min_lon: 0,
        max_lat: 0,
        max_lon: 0,
        time: 0,
        length: 0,
        cost: 0,
      };
  const routeData = selectedRoute?.shape
    ? {
        trip: {
          legs: [{ shape: selectedRoute.shape, maneuvers: [], summary: summary }],
          obstacles: obstacles,
          summary: summary,
          locations: [],
          status_message: "",
          status: 0,
          units: "km",
          language: "ja-JP",
        },
        admins: [],
        units: "km",
        language: "ja-JP",
      }
    : null;

  // dangerLevelごとの障害物数をカウントする関数
  function countObstaclesByLevel(obstacles: any[] | null | undefined, level: number) {
    if (!Array.isArray(obstacles)) return 0;
    return obstacles.filter(o => (o.dangerLevel ?? o.danger_level) === level).length;
  }
  // 歩行速度（km/h）を計算
  function calcSpeed(distance: number, duration: number) {
    if (!distance || !duration) return 0;
    return (distance / (duration / 3600));
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">自分の移動記録一覧</h1>
      {userLoading && <div>認証確認中...</div>}
      {!user && !userLoading && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          <h2 className="font-bold mb-2">アクセス権限がありません</h2>
          <p>このページはログインが必要です。</p>
          <a href="/auth" className="text-blue-500 underline">ログインページへ</a>
        </div>
      )}
      {user && (
        <>
          {loading && <div>読み込み中...</div>}
          {error && <div className="text-red-500">{error}</div>}
          <div className="w-full h-80 mb-4">
            <RouteMap
              routeData={routeData}
              isLoading={false}
              startPosition={shapePoints[0] || null}
              endPosition={shapePoints[shapePoints.length - 1] || null}
              onMapClick={() => {}}
              trackPoints={shapePoints}
              isRecording={false}
              height="320px"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">タイトル</th>
                  <th className="border px-2 py-1">日付</th>
                  <th className="border px-2 py-1">距離(km)</th>
                  <th className="border px-2 py-1">開始</th>
                  <th className="border px-2 py-1">終了</th>
                  <th className="border px-2 py-1">速度(km/h)</th>
                  <th className="border px-2 py-1">障害物(低)</th>
                  <th className="border px-2 py-1">障害物(中)</th>
                  <th className="border px-2 py-1">障害物(高)</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(route => (
                  <tr
                    key={route.id}
                    className={selectedId === route.id ? "bg-blue-200" : ""}
                    onClick={() => setSelectedId(route.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="border px-2 py-1">{route.title || "無題の記録"}</td>
                    <td className="border px-2 py-1">{new Date(route.created_at).toLocaleDateString()}</td>
                    <td className="border px-2 py-1">{route.distance?.toFixed(2)}</td>
                    <td className="border px-2 py-1">{new Date(route.start_time).toLocaleTimeString()}</td>
                    <td className="border px-2 py-1">{new Date(route.end_time).toLocaleTimeString()}</td>
                    <td className="border px-2 py-1">{calcSpeed(route.distance, route.duration).toFixed(2)}</td>
                    <td className="border px-2 py-1">{countObstaclesByLevel(route.obstacles, 0)}</td>
                    <td className="border px-2 py-1">{countObstaclesByLevel(route.obstacles, 1)}</td>
                    <td className="border px-2 py-1">{countObstaclesByLevel(route.obstacles, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {routes.length === 0 && !loading && <div>記録がありません。</div>}
        </>
      )}
    </main>
  )
} 