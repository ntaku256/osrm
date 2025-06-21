"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { MapPin, Navigation, AlertTriangle, ArrowLeft, Settings } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { routeApi } from "@/utils/api"
import { RouteResponse, RouteLocation, ObstacleDetectionMethod } from "@/types/route"

// RouteMapコンポーネントをdynamic importでSSRを無効化
const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">地図を読み込み中...</div>
    </div>
  ),
})

export default function RoutePage() {
  const [startPosition, setStartPosition] = useState<[number, number] | null>(null)
  const [endPosition, setEndPosition] = useState<[number, number] | null>(null)
  const [startInput, setStartInput] = useState("")
  const [endInput, setEndInput] = useState("")
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clickMode, setClickMode] = useState<'start' | 'end' | null>(null)
  const [detectionMethod, setDetectionMethod] = useState<ObstacleDetectionMethod>('distance')
  const [distanceThreshold, setDistanceThreshold] = useState<number>(0.02)

  // 障害物検出方法の選択肢
  const detectionMethodOptions = [
    { value: 'distance' as ObstacleDetectionMethod, label: '距離判定のみ' },
    { value: 'nodes' as ObstacleDetectionMethod, label: 'ノード一致のみ' },
    { value: 'both' as ObstacleDetectionMethod, label: '両方' }
  ]

  const handleMapClick = (position: [number, number], mode: 'start' | 'end') => {
    console.log("=== HANDLE MAP CLICK DEBUG ===")
    console.log("Position:", position)
    console.log("Mode from map:", mode)
    console.log("Current clickMode state:", clickMode)
    
    if (mode === 'start') {
      console.log("✅ Processing START click")
      setStartPosition(position)
      setStartInput(`${position[0].toFixed(6)}, ${position[1].toFixed(6)}`)
      setClickMode(null)
      console.log("✅ START position set, clickMode reset to null")
    } else if (mode === 'end') {
      console.log("✅ Processing END click")
      setEndPosition(position)
      setEndInput(`${position[0].toFixed(6)}, ${position[1].toFixed(6)}`)
      setClickMode(null)
      console.log("✅ END position set, clickMode reset to null")
    }
    console.log("=== END HANDLE MAP CLICK DEBUG ===")
  }

  const parseCoordinates = (input: string): [number, number] | null => {
    const parts = input.split(',').map(part => part.trim())
    if (parts.length === 2) {
      const lat = parseFloat(parts[0])
      const lon = parseFloat(parts[1])
      if (!isNaN(lat) && !isNaN(lon)) {
        return [lat, lon]
      }
    }
    return null
  }

  const handleStartInputChange = (value: string) => {
    setStartInput(value)
    const coords = parseCoordinates(value)
    if (coords) {
      setStartPosition(coords)
    }
  }

  const handleEndInputChange = (value: string) => {
    setEndInput(value)
    const coords = parseCoordinates(value)
    if (coords) {
      setEndPosition(coords)
    }
  }

  const searchRoute = async () => {
    if (!startPosition || !endPosition) {
      setError("出発地点と目的地を設定してください")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const locations: RouteLocation[] = [
        { lat: startPosition[0], lon: startPosition[1] },
        { lat: endPosition[0], lon: endPosition[1] }
      ]

      const response = await routeApi.getRouteWithObstacles({
        locations,
        language: 'ja-JP',
        costing: 'auto',
        detection_method: detectionMethod,
        distance_threshold: distanceThreshold
      })

      if (response.error) {
        setError(response.error)
      } else if (response.data) {
        setRouteData(response.data)
      }
    } catch (err) {
      setError('ルート検索中にエラーが発生しました')
      console.error('Route search error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const resetRoute = () => {
    setRouteData(null)
    setStartPosition(null)
    setEndPosition(null)
    setStartInput("")
    setEndInput("")
    setError(null)
    setClickMode(null)
    setDetectionMethod('distance')
    setDistanceThreshold(0.02)
  }

  const setClickModeForStart = () => {
    const newMode = clickMode === 'start' ? null : 'start'
    console.log("Setting click mode for start:", newMode)
    setClickMode(newMode)
  }

  const setClickModeForEnd = () => {
    const newMode = clickMode === 'end' ? null : 'end'
    console.log("Setting click mode for end:", newMode)
    setClickMode(newMode)
  }

  // サンプル座標をセット
  const setSampleCoordinates = () => {
    const sampleStart: [number, number] = [33.888341, 135.162688]
    const sampleEnd: [number, number] = [33.884195, 135.153661]
    
    setStartPosition(sampleStart)
    setEndPosition(sampleEnd)
    setStartInput(`${sampleStart[0]}, ${sampleStart[1]}`)
    setEndInput(`${sampleEnd[0]}, ${sampleEnd[1]}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                マップ登録に戻る
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ルート検索（障害物表示付き）
          </h1>
          <p className="text-gray-600">
            出発地点と目的地を設定して、ルート上の障害物を確認できます
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 検索パネル */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  ルート設定
                </CardTitle>
                <CardDescription>
                  座標を入力するか、地図をクリックして設定
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 出発地点 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">出発地点</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="緯度, 経度 (例: 33.888341, 135.162688)"
                      value={startInput}
                      onChange={(e) => handleStartInputChange(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant={clickMode === 'start' ? 'default' : 'outline'}
                      size="sm"
                      onClick={setClickModeForStart}
                      className={`${clickMode === 'start' ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'hover:bg-green-50'} transition-all`}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                  {clickMode === 'start' && (
                    <div className="text-xs text-green-600 font-medium animate-pulse bg-green-50 p-2 rounded">
                      🗺️ 地図をクリックして出発地点を設定してください
                    </div>
                  )}
                </div>

                {/* 目的地 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">目的地</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="緯度, 経度 (例: 33.884195, 135.153661)"
                      value={endInput}
                      onChange={(e) => handleEndInputChange(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant={clickMode === 'end' ? 'default' : 'outline'}
                      size="sm"
                      onClick={setClickModeForEnd}
                      className={`${clickMode === 'end' ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'hover:bg-red-50'} transition-all`}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                  {clickMode === 'end' && (
                    <div className="text-xs text-red-600 font-medium animate-pulse bg-red-50 p-2 rounded">
                      🗺️ 地図をクリックして目的地を設定してください
                    </div>
                  )}
                </div>

                {/* 障害物検出方法 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">障害物検出方法</label>
                  <Select
                    value={detectionMethod}
                    onValueChange={(value) => {
                      setDetectionMethod(value as ObstacleDetectionMethod)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="障害物検出方法を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {detectionMethodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 距離閾値 */}
                {(detectionMethod === 'distance' || detectionMethod === 'both') && (
                  <div className="space-y-2">
                    <Label htmlFor="distance-threshold" className="text-sm font-medium">
                      距離閾値 (km)
                    </Label>
                    <Input
                      id="distance-threshold"
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={distanceThreshold}
                      onChange={(e) => setDistanceThreshold(parseFloat(e.target.value) || 0.02)}
                      placeholder="0.02"
                    />
                    <p className="text-xs text-gray-500">
                      この距離以内の障害物を検出します（デフォルト: 0.02km = 20m）
                    </p>
                  </div>
                )}

                {/* ボタン */}
                <div className="space-y-2">
                  <Button
                    onClick={searchRoute}
                    disabled={!startPosition || !endPosition || isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'ルート検索中...' : 'ルート検索'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={setSampleCoordinates}
                    className="w-full"
                  >
                    サンプル座標を使用
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetRoute}
                    className="w-full"
                  >
                    リセット
                  </Button>
                </div>

                {/* エラー表示 */}
                {error && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* ルート情報表示 */}
            {routeData && (
              <Card>
                <CardHeader>
                  <CardTitle>ルート詳細</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">距離</p>
                      <p className="font-semibold">
                        {routeData.trip?.summary?.length?.toFixed(1)}km
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">時間</p>
                      <p className="font-semibold">
                        {Math.round((routeData.trip?.summary?.time || 0) / 60)}分
                      </p>
                    </div>
                  </div>
                  
                  {routeData.obstacles && routeData.obstacles.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-red-600 font-medium mb-2">
                        ⚠️ 障害物 {routeData.obstacles.length}個検出
                      </p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {routeData.obstacles.map((obstacle, index) => (
                          <div key={index} className="text-xs p-2 bg-red-50 rounded">
                            <p className="font-medium">{obstacle.description}</p>
                            <p className="text-gray-600">
                              危険度: {obstacle.dangerLevel === 0 ? '低' : obstacle.dangerLevel === 1 ? '中' : '高'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* マップ */}
          <div className="lg:col-span-2">
            <Card className="h-[700px]">
              <CardContent className="p-0 h-full">
                <RouteMap
                  routeData={routeData}
                  isLoading={isLoading}
                  startPosition={startPosition}
                  endPosition={endPosition}
                  onMapClick={handleMapClick}
                  clickMode={clickMode}
                />
                {/* デバッグ用：現在の状態表示 */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="absolute bottom-2 right-2 bg-yellow-100 p-2 rounded text-xs">
                    <div>clickMode: {clickMode || 'null'}</div>
                    <div>start: {startPosition ? 'set' : 'null'}</div>
                    <div>end: {endPosition ? 'set' : 'null'}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 