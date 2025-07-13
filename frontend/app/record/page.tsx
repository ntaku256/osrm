"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { apiFetch } from "@/lib/api"
import { useBackendUser } from "@/hooks/useBackendUser"
const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false })

interface WalkedRoute {
  id: string
  title: string
  start_time: string
  end_time: string
  distance: number
  created_at: string
  trace_raw: { lat: number, lon: number }[]
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

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">自分の移動記録一覧</h1>
      {loading && <div>読み込み中...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <div className="w-full h-80 mb-4">
        <RouteMap
          routeData={null}
          isLoading={false}
          startPosition={selectedRoute?.trace_raw[0] ? [selectedRoute.trace_raw[0].lat, selectedRoute.trace_raw[0].lon] : null}
          endPosition={selectedRoute?.trace_raw[selectedRoute?.trace_raw.length-1] ? [selectedRoute.trace_raw[selectedRoute.trace_raw.length-1].lat, selectedRoute.trace_raw[selectedRoute.trace_raw.length-1].lon] : null}
          onMapClick={() => {}}
          trackPoints={selectedRoute?.trace_raw.map(p => [p.lat, p.lon] as [number, number]) ?? []}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {routes.length === 0 && !loading && <div>記録がありません。</div>}
    </main>
  )
} 