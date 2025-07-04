"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { MapPin, Navigation, AlertTriangle, ArrowLeft, Settings, MapPinned, Play, Square, Save, Trash2 } from "lucide-react"
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

// 位置情報の型定義
interface TrackPoint {
  lat: number
  lon: number
  timestamp: number
  accuracy?: number
}

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

  // GPS関連の状態
  const [isGpsSupported, setIsGpsSupported] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  // 移動記録関連の状態
  const [isRecording, setIsRecording] = useState(false)
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null)
  const watchIdRef = useRef<number | null>(null)

  // コンポーネント初期化時にGPS対応チェック
  useEffect(() => {
    setIsGpsSupported('geolocation' in navigator)
  }, [])

  // 移動記録の開始/停止
  useEffect(() => {
    if (isRecording && isGpsSupported) {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }

      const handleSuccess = (position: GeolocationPosition) => {
        const newPoint: TrackPoint = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy
        }

        setTrackPoints(prev => [...prev, newPoint])
        setCurrentPosition([position.coords.latitude, position.coords.longitude])
        setGpsError(null)
      }

      const handleError = (error: GeolocationPositionError) => {
        console.error('GPS tracking error:', error)
        setGpsError(`位置情報の取得に失敗しました: ${error.message}`)
      }

      // 位置情報の監視を開始
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        options
      )

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
      }
    } else {
      // 記録停止時は監視をクリア
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isRecording, isGpsSupported])

  // 障害物検出方法の選択肢
  const detectionMethodOptions = [
    { value: 'distance' as ObstacleDetectionMethod, label: '距離判定のみ' },
    { value: 'nodes' as ObstacleDetectionMethod, label: 'ノード一致のみ' },
    { value: 'both' as ObstacleDetectionMethod, label: '両方' }
  ]

  // 現在位置を取得してスタート地点に設定
  const getCurrentLocation = () => {
    if (!isGpsSupported) {
      setGpsError('このブラウザはGPS機能に対応していません')
      return
    }

    setIsGettingLocation(true)
    setGpsError(null)

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [position.coords.latitude, position.coords.longitude]
        setStartPosition(coords)
        setStartInput(`${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`)
        setCurrentPosition(coords)
        setIsGettingLocation(false)
        setGpsError(null)
      },
      (error) => {
        console.error('GPS error:', error)
        let errorMessage = '位置情報の取得に失敗しました'

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '位置情報の使用が拒否されました。ブラウザの設定を確認してください。'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置情報が利用できません'
            break
          case error.TIMEOUT:
            errorMessage = '位置情報の取得がタイムアウトしました'
            break
        }

        setGpsError(errorMessage)
        setIsGettingLocation(false)
      },
      options
    )
  }

  // 移動記録の開始
  const startRecording = () => {
    if (!isGpsSupported) {
      setGpsError('このブラウザはGPS機能に対応していません')
      return
    }

    setTrackPoints([])
    setIsRecording(true)
    setGpsError(null)
  }

  // 移動記録の停止
  const stopRecording = () => {
    setIsRecording(false)
  }

  // 移動記録のクリア
  const clearTrack = () => {
    setTrackPoints([])
    setCurrentPosition(null)
    setIsRecording(false)
  }

  // 移動記録の保存（将来的にバックエンドに送信する予定）
  const saveTrack = () => {
    if (trackPoints.length === 0) {
      setError('保存する移動記録がありません')
      return
    }

    // 今後、バックエンドAPIに送信する処理を実装
    console.log('移動記録を保存:', {
      points: trackPoints,
      totalPoints: trackPoints.length,
      duration: trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].timestamp - trackPoints[0].timestamp : 0
    })

    // 一時的な成功メッセージ
    alert(`移動記録を保存しました（${trackPoints.length}ポイント）`)
  }

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

                  {/* GPS現在位置取得ボタン */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={getCurrentLocation}
                      disabled={!isGpsSupported || isGettingLocation}
                      className="flex-1"
                    >
                      <MapPinned className="h-4 w-4 mr-2" />
                      {isGettingLocation ? '位置取得中...' : '現在位置を取得'}
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

                {/* GPS・エラー表示 */}
                {(error || gpsError) && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error || gpsError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 移動記録パネル */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  移動記録
                </CardTitle>
                <CardDescription>
                  実際の移動経路を記録できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 記録状態表示 */}
                {isRecording && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">記録中... ({trackPoints.length}ポイント)</span>
                    </div>
                    {currentPosition && (
                      <div className="text-xs text-green-600 mt-1">
                        現在位置: {currentPosition[0].toFixed(6)}, {currentPosition[1].toFixed(6)}
                      </div>
                    )}
                  </div>
                )}

                {/* 記録情報表示 */}
                {trackPoints.length > 0 && !isRecording && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-700">
                      <div>記録ポイント数: {trackPoints.length}</div>
                      {trackPoints.length > 1 && (
                        <div>
                          記録時間: {Math.round((trackPoints[trackPoints.length - 1].timestamp - trackPoints[0].timestamp) / 1000 / 60)}分
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 記録制御ボタン */}
                <div className="space-y-2">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      disabled={!isGpsSupported}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      移動記録開始
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      記録停止
                    </Button>
                  )}

                  {trackPoints.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={saveTrack}
                        disabled={isRecording}
                        className="flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        onClick={clearTrack}
                        disabled={isRecording}
                        className="flex-1"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        クリア
                      </Button>
                    </div>
                  )}
                </div>

                {!isGpsSupported && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      このブラウザはGPS機能に対応していません
                    </AlertDescription>
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
                  currentPosition={currentPosition}
                  trackPoints={trackPoints.map(point => [point.lat, point.lon] as [number, number])}
                  isRecording={isRecording}
                />
                {/* デバッグ用：現在の状態表示 */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="absolute bottom-2 right-2 bg-yellow-100 p-2 rounded text-xs">
                    <div>clickMode: {clickMode || 'null'}</div>
                    <div>start: {startPosition ? 'set' : 'null'}</div>
                    <div>end: {endPosition ? 'set' : 'null'}</div>
                    <div>recording: {isRecording ? 'yes' : 'no'}</div>
                    <div>trackPoints: {trackPoints.length}</div>
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