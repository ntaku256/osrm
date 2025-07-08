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
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [excludeLocations, setExcludeLocations] = useState<[number, number][]>([])
  const [selectedObstacle, setSelectedObstacle] = useState<number | null>(null) // 選択された障害物のID
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0) // 選択されたルートのインデックス
  const [startInput, setStartInput] = useState("")
  const [endInput, setEndInput] = useState("")
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clickMode, setClickMode] = useState<'start' | 'end' | 'waypoint' | 'exclude' | null>(null)
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

  const handleMapClick = (position: [number, number], mode: 'start' | 'end' | 'waypoint' | 'exclude') => {
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
    } else if (mode === 'waypoint') {
      console.log("✅ Processing WAYPOINT click")
      setWaypoints(prev => [...prev, position])
      setClickMode(null)
      console.log("✅ WAYPOINT added, clickMode reset to null")
    } else if (mode === 'exclude') {
      console.log("✅ Processing EXCLUDE click")
      setExcludeLocations(prev => [...prev, position])
      setClickMode(null)
      console.log("✅ EXCLUDE location added, clickMode reset to null")
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
        waypoints: waypoints.length > 0 ? waypoints.map(wp => ({ lat: wp[0], lon: wp[1] })) : undefined,
        exclude_locations: excludeLocations.length > 0 ? excludeLocations.map(ex => ({ lat: ex[0], lon: ex[1] })) : undefined,
        language: 'ja-JP',
        costing: 'pedestrian',
        detection_method: detectionMethod,
        distance_threshold: distanceThreshold,
        alternates: {
          destination_only: true,
          alternates: 3,
        },
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
    setWaypoints([])
    setExcludeLocations([])
    setSelectedObstacle(null)
    setSelectedRouteIndex(0)
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

  const setClickModeForWaypoint = () => {
    const newMode = clickMode === 'waypoint' ? null : 'waypoint'
    console.log("Setting click mode for waypoint:", newMode)
    setClickMode(newMode)
  }

  const setClickModeForExclude = () => {
    const newMode = clickMode === 'exclude' ? null : 'exclude'
    console.log("Setting click mode for exclude:", newMode)
    setClickMode(newMode)
  }

  // 中継地点を削除
  const removeWaypoint = (index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index))
  }

  // 回避地点を削除
  const removeExcludeLocation = (index: number) => {
    setExcludeLocations(prev => prev.filter((_, i) => i !== index))
  }

  // 障害物から回避地点を追加
  const addObstacleToExcludeList = (position: [number, number]) => {
    // 既に追加されているかチェック
    const exists = excludeLocations.some(loc => 
      Math.abs(loc[0] - position[0]) < 0.0001 && Math.abs(loc[1] - position[1]) < 0.0001
    )
    
    if (!exists) {
      setExcludeLocations(prev => [...prev, position])
    }
  }

  // 障害物を選択/選択解除
  const toggleObstacleSelection = (obstacleId: number) => {
    setSelectedObstacle(prev => prev === obstacleId ? null : obstacleId)
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

  // ルートごとのtrip取得ヘルパー
  const getCurrentTrip = () => {
    if (!routeData) return null;
    if (selectedRouteIndex === 0) {
      return routeData.trip || null;
    }
    if (
      routeData.alternates &&
      routeData.alternates.length > selectedRouteIndex - 1
    ) {
      return routeData.alternates[selectedRouteIndex - 1]?.trip || null;
    }
    return null;
  };

  // 障害物リスト取得
  const getCurrentTripObstacles = () => {
    const trip = getCurrentTrip();
    return trip?.obstacles || [];
  };

  // ルート選択UI用: ルート数・ラベル・summary参照
  const getRouteCount = () => {
    if (!routeData) return 0;
    if (routeData.alternates && routeData.alternates.length > 0) {
      return 1 + routeData.alternates.length;
    }
    return 1;
  };

  const getRouteSummary = (index: number) => {
    if (!routeData) return null;
    if (index === 0) {
      return routeData.trip?.summary || null;
    }
    if (
      routeData.alternates &&
      routeData.alternates.length > index - 1
    ) {
      return routeData.alternates[index - 1]?.trip?.summary || null;
    }
    return null;
  };

  // ルートデータやルート数が変わったときにselectedRouteIndexをリセット
  useEffect(() => {
    if (selectedRouteIndex >= getRouteCount()) {
      setSelectedRouteIndex(0);
    }
  }, [routeData]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
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

                {/* 中継地点 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">中継地点</label>
                    <Button
                      variant={clickMode === 'waypoint' ? 'default' : 'outline'}
                      size="sm"
                      onClick={setClickModeForWaypoint}
                      className={`${clickMode === 'waypoint' ? 'bg-blue-600 hover:bg-blue-700 animate-pulse' : 'hover:bg-blue-50'} transition-all`}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      追加
                    </Button>
                  </div>
                  
                  {clickMode === 'waypoint' && (
                    <div className="text-xs text-blue-600 font-medium animate-pulse bg-blue-50 p-2 rounded">
                      🗺️ 地図をクリックして中継地点を追加してください
                    </div>
                  )}
                  
                  {waypoints.length > 0 && (
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {waypoints.map((waypoint, index) => (
                        <div key={index} className="flex items-center justify-between bg-blue-50 border border-blue-200 p-2 rounded text-xs">
                          <span className="text-gray-900 font-medium">
                            {index + 1}. {waypoint[0].toFixed(6)}, {waypoint[1].toFixed(6)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWaypoint(index)}
                            className="h-6 w-6 p-0 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 border border-red-300"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 回避地点 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">回避地点</label>
                    <Button
                      variant={clickMode === 'exclude' ? 'default' : 'outline'}
                      size="sm"
                      onClick={setClickModeForExclude}
                      className={`${clickMode === 'exclude' ? 'bg-gray-600 hover:bg-gray-700 animate-pulse' : 'hover:bg-gray-50'} transition-all`}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      追加
                    </Button>
                  </div>
                  
                  {clickMode === 'exclude' && (
                    <div className="text-xs text-gray-600 font-medium animate-pulse bg-gray-50 p-2 rounded">
                      🗺️ 地図をクリックして回避地点を追加してください
                    </div>
                  )}
                  
                  {excludeLocations.length > 0 && (
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {excludeLocations.map((exclude, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-300 p-2 rounded text-xs">
                          <span className="text-gray-900 font-medium">
                            {index + 1}. {exclude[0].toFixed(6)}, {exclude[1].toFixed(6)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExcludeLocation(index)}
                            className="h-6 w-6 p-0 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 border border-red-300"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
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
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
                    className="w-full border-red-300 text-red-700 hover:bg-red-50"
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
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      移動記録開始
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
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
                        className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        onClick={clearTrack}
                        disabled={isRecording}
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
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

            {/* 複数ルート選択 */}
            {routeData && getRouteCount() > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🛣️ ルート選択
                  </CardTitle>
                  <CardDescription>
                    {getRouteCount()}つのルートが見つかりました
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...Array(getRouteCount())].map((_, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedRouteIndex === index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                      }`}
                      onClick={() => setSelectedRouteIndex(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            selectedRouteIndex === index ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="font-medium text-gray-900">
                            ルート {index + 1}
                          </span>
                        </div>
                        {selectedRouteIndex === index && (
                          <div className="text-blue-500 text-xs font-medium">選択中</div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mt-2">
                        <div>
                          <span className="font-medium">距離:</span> {getRouteSummary(index)?.length?.toFixed(1)}km
                        </div>
                        <div>
                          <span className="font-medium">時間:</span> {Math.round((getRouteSummary(index)?.time || 0) / 60)}分
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

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
                        {(() => {
                          const summary = getRouteSummary(selectedRouteIndex);
                          return summary?.length?.toFixed(1);
                        })()}km
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">時間</p>
                      <p className="font-semibold">
                        {(() => {
                          const summary = getRouteSummary(selectedRouteIndex);
                          return Math.round((summary?.time || 0) / 60);
                        })()}分
                      </p>
                    </div>
                  </div>

                  {getCurrentTripObstacles().length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-red-600 font-medium mb-2">
                        ⚠️ 障害物 {getCurrentTripObstacles().length}個検出
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {getCurrentTripObstacles().map((obstacle, index) => (
                          <div 
                            key={index} 
                            className={`text-xs p-2 rounded cursor-pointer transition-all ${
                              selectedObstacle === obstacle.id 
                                ? 'bg-red-200 border-2 border-red-400' 
                                : 'bg-red-50 border border-red-100 hover:bg-red-100'
                            }`}
                            onClick={() => toggleObstacleSelection(obstacle.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{obstacle.description}</p>
                                <p className="text-gray-700">
                                  危険度: {obstacle.dangerLevel === 0 ? '低' : obstacle.dangerLevel === 1 ? '中' : '高'}
                                </p>
                                <p className="text-gray-600 text-xs">
                                  {obstacle.position[0].toFixed(6)}, {obstacle.position[1].toFixed(6)}
                                </p>
                                {selectedObstacle === obstacle.id && (
                                  <p className="text-red-600 text-xs font-medium mt-1">
                                    📍 地図上でハイライト表示中
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 ml-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    addObstacleToExcludeList(obstacle.position)
                                  }}
                                  className={`h-6 px-2 text-xs border ${
                                    excludeLocations.some(loc => 
                                      Math.abs(loc[0] - obstacle.position[0]) < 0.0001 && 
                                      Math.abs(loc[1] - obstacle.position[1]) < 0.0001
                                    )
                                      ? 'bg-green-100 text-green-700 border-green-300 cursor-not-allowed'
                                      : 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800'
                                  }`}
                                  disabled={excludeLocations.some(loc => 
                                    Math.abs(loc[0] - obstacle.position[0]) < 0.0001 && 
                                    Math.abs(loc[1] - obstacle.position[1]) < 0.0001
                                  )}
                                >
                                  {excludeLocations.some(loc => 
                                    Math.abs(loc[0] - obstacle.position[0]) < 0.0001 && 
                                    Math.abs(loc[1] - obstacle.position[1]) < 0.0001
                                  ) ? '追加済み' : '回避'}
                                </Button>
                                <Button
                                  variant={selectedObstacle === obstacle.id ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleObstacleSelection(obstacle.id)
                                  }}
                                  className={`h-6 px-2 text-xs border ${
                                    selectedObstacle === obstacle.id
                                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                      : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 hover:text-blue-800'
                                  }`}
                                >
                                  {selectedObstacle === obstacle.id ? '選択中' : '選択'}
                                </Button>
                              </div>
                            </div>
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
            <Card className="h-[800px]">
              <CardContent className="p-0 h-full">
                <RouteMap
                  routeData={routeData}
                  selectedRouteIndex={selectedRouteIndex}
                  isLoading={isLoading}
                  startPosition={startPosition}
                  endPosition={endPosition}
                  waypoints={waypoints}
                  excludeLocations={excludeLocations}
                  selectedObstacle={selectedObstacle}
                  onMapClick={handleMapClick}
                  onAddToExcludeList={addObstacleToExcludeList}
                  clickMode={clickMode}
                  currentPosition={currentPosition}
                  trackPoints={trackPoints.map(point => [point.lat, point.lon] as [number, number])}
                  isRecording={isRecording}
                  onRouteSelect={setSelectedRouteIndex}
                />
                {/* デバッグ用：現在の状態表示
                {process.env.NODE_ENV === 'development' && (
                  <div className="absolute bottom-2 right-2 bg-yellow-100 p-2 rounded text-xs">
                    <div>clickMode: {clickMode || 'null'}</div>
                    <div>start: {startPosition ? 'set' : 'null'}</div>
                    <div>end: {endPosition ? 'set' : 'null'}</div>
                    <div>waypoints: {waypoints.length}</div>
                    <div>excludes: {excludeLocations.length}</div>
                    <div>recording: {isRecording ? 'yes' : 'no'}</div>
                    <div>trackPoints: {trackPoints.length}</div>
                  </div>
                )} */}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 