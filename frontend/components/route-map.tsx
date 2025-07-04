// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { RouteResponse } from "@/types/route"
import { DangerLevel, ObstacleType } from "@/types/obstacle"
import { decodePolyline, testDecodeWithBothPrecisions } from "@/utils/polyline"

// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/marker-icon-2x.png",
    iconUrl: "/marker-icon.png",
    shadowUrl: "/marker-shadow.png",
  })
}

interface RouteMapProps {
  routeData: RouteResponse | null
  isLoading: boolean
  startPosition: [number, number] | null
  endPosition: [number, number] | null
  onMapClick: (position: [number, number], mode: 'start' | 'end') => void
  clickMode?: 'start' | 'end' | null
  currentPosition?: [number, number] | null
  trackPoints?: [number, number][]
  isRecording?: boolean
}

export default function RouteMap({
  routeData,
  isLoading,
  startPosition,
  endPosition,
  onMapClick,
  clickMode,
  currentPosition,
  trackPoints = [],
  isRecording = false,
}: RouteMapProps) {
  const mapRef = useRef(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const routeLayerRef = useRef(null)
  const markersLayerRef = useRef(null)
  const obstacleMarkersRef = useRef(null)
  const trackLayerRef = useRef(null)
  const currentPositionMarkerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapCenter] = useState<[number, number]>([33.881292, 135.157809])
  const [mapZoom] = useState<number>(14)

  // clickModeの最新値を参照するためのref
  const clickModeRef = useRef(clickMode)
  useEffect(() => {
    clickModeRef.current = clickMode
  }, [clickMode])

  // マップの初期化
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return

    fixLeafletIcon()

    const initializeMap = () => {
      if (!mapContainerRef.current) return

      try {
        const map = L.map(mapContainerRef.current, {
          center: mapCenter,
          zoom: mapZoom,
          zoomControl: false,
        })

        L.control.zoom({ position: "topright" }).addTo(map)

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        routeLayerRef.current = L.layerGroup().addTo(map)
        markersLayerRef.current = L.layerGroup().addTo(map)
        obstacleMarkersRef.current = L.layerGroup().addTo(map)
        trackLayerRef.current = L.layerGroup().addTo(map)
        currentPositionMarkerRef.current = L.layerGroup().addTo(map)

        // 既存のコードと同じ方式でマップクリックを処理
        map.on("click", (e) => {
          console.log("=== MAP CLICK EVENT ===")
          console.log("Clicked at:", e.latlng.lat, e.latlng.lng)
          console.log("Current clickModeRef:", clickModeRef.current)
          console.log("Props clickMode:", clickMode)

          if (clickModeRef.current === 'start' || clickModeRef.current === 'end') {
            console.log("✅ Mode is active - calling onMapClick")
            const { lat, lng } = e.latlng
            onMapClick([lat, lng], clickModeRef.current)
          } else {
            console.log("❌ No active click mode - ignoring click")
          }
          console.log("=== END MAP CLICK EVENT ===")
        })

        mapRef.current = map
        setMapReady(true)

        setTimeout(() => {
          map.invalidateSize()
        }, 100)
      } catch (error) {
        console.error("Failed to initialize map:", error)
      }
    }

    const timer = setTimeout(initializeMap, 100)
    return () => clearTimeout(timer)
  }, [mapCenter, mapZoom, onMapClick])

  // 現在位置マーカーの更新
  useEffect(() => {
    if (!mapReady || !mapRef.current || !currentPositionMarkerRef.current) return

    currentPositionMarkerRef.current.clearLayers()

    if (currentPosition) {
      const currentIcon = L.divIcon({
        className: "current-position-marker",
        html: `<div class="relative">
          <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
          ${isRecording ? '<div class="absolute -inset-1 bg-blue-500 rounded-full animate-ping opacity-75"></div>' : ''}
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      L.marker(currentPosition, { icon: currentIcon })
        .addTo(currentPositionMarkerRef.current)
        .bindPopup(isRecording ? "現在位置（記録中）" : "現在位置")
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
        })
    }
  }, [mapReady, currentPosition, isRecording])

  // 移動経路の表示
  useEffect(() => {
    if (!mapReady || !mapRef.current || !trackLayerRef.current) return

    trackLayerRef.current.clearLayers()

    if (trackPoints && trackPoints.length > 1) {
      // 移動経路のポリライン
      const trackPolyline = L.polyline(trackPoints, {
        color: isRecording ? '#3b82f6' : '#6b7280',
        weight: 4,
        opacity: 0.8,
        dashArray: isRecording ? undefined : '5, 5'
      }).addTo(trackLayerRef.current)

      // 記録中の場合、軌跡の開始点にマーカーを追加
      if (trackPoints.length > 0) {
        const startIcon = L.divIcon({
          className: "track-start-marker",
          html: `<div class="w-3 h-3 bg-blue-600 rounded-full border border-white shadow"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        L.marker(trackPoints[0], { icon: startIcon })
          .addTo(trackLayerRef.current)
          .bindPopup("移動開始地点")
      }
    }
  }, [mapReady, trackPoints, isRecording])

  // Start/End マーカーの更新
  useEffect(() => {
    if (!mapReady || !mapRef.current || !markersLayerRef.current) return

    markersLayerRef.current.clearLayers()

    // スタートマーカー
    if (startPosition) {
      const startIcon = L.divIcon({
        className: "route-marker",
        html: `<div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg">S</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      L.marker(startPosition, { icon: startIcon })
        .addTo(markersLayerRef.current)
        .bindPopup("出発地点")
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
        })
    }

    // エンドマーカー
    if (endPosition) {
      const endIcon = L.divIcon({
        className: "route-marker",
        html: `<div class="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg">E</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      L.marker(endPosition, { icon: endIcon })
        .addTo(markersLayerRef.current)
        .bindPopup("目的地")
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
        })
    }
  }, [mapReady, startPosition, endPosition])

  // ルートと障害物の表示
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    // ルートレイヤーを常にクリア
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers()
    }
    if (obstacleMarkersRef.current) {
      obstacleMarkersRef.current.clearLayers()
    }

    // routeDataがnullの場合はクリアのみで終了
    if (!routeData) return

    try {
      // ルートの描画
      if (routeData.trip && routeData.trip.legs) {
        routeData.trip.legs.forEach((leg) => {
          if (leg.shape) {
            // 両方の精度でテストデコード
            const testResults = testDecodeWithBothPrecisions(leg.shape)
            console.log("Testing precision 5:", testResults.precision5.slice(0, 3))
            console.log("Testing precision 6:", testResults.precision6.slice(0, 3))

            // Valhalla用精度6でデコード
            const coordinates = decodePolyline(leg.shape, 6)

            console.log("Route coordinates bounds:", {
              minLat: Math.min(...coordinates.map(c => c[0])),
              maxLat: Math.max(...coordinates.map(c => c[0])),
              minLng: Math.min(...coordinates.map(c => c[1])),
              maxLng: Math.max(...coordinates.map(c => c[1]))
            })

            // 座標が日本の範囲内かチェック
            const isInJapanRange = coordinates.every(([lat, lng]) =>
              lat >= 20 && lat <= 46 && lng >= 123 && lng <= 146
            )
            console.log("Coordinates in Japan range:", isInJapanRange)

            // もし精度6で範囲外なら精度5を試す
            if (!isInJapanRange && coordinates.length > 0) {
              console.log("Trying precision 5 instead...")
              const coordinatesPrecision5 = decodePolyline(leg.shape, 5)
              const isInJapanRangeP5 = coordinatesPrecision5.every(([lat, lng]) =>
                lat >= 20 && lat <= 46 && lng >= 123 && lng <= 146
              )
              console.log("Precision 5 coordinates in Japan range:", isInJapanRangeP5)

              if (isInJapanRangeP5) {
                // 精度5の方が正しい場合はそちらを使用
                coordinates.length = 0
                coordinates.push(...coordinatesPrecision5)
              }
            }

            // ルートライン
            const routeLine = L.polyline(coordinates, {
              color: '#3388ff',
              weight: 6,
              opacity: 0.8,
            }).addTo(routeLayerRef.current)
              .on('click', (e) => {
                L.DomEvent.stopPropagation(e)
              })

            // ルートの境界にマップをフィット
            mapRef.current.fitBounds(routeLine.getBounds(), { padding: [20, 20] })
          }
        })
      }

      // 障害物マーカーの表示
      if (routeData.obstacles && routeData.obstacles.length > 0) {
        routeData.obstacles.forEach((obstacle) => {
          const obstacleIcon = L.divIcon({
            className: "obstacle-marker",
            html: `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg animate-pulse ${getDangerLevelColor(obstacle.dangerLevel)}">
              ${getObstacleTypeIcon(obstacle.type)}
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })

          const marker = L.marker(obstacle.position, { icon: obstacleIcon })
            .addTo(obstacleMarkersRef.current)
            .on('click', (e) => {
              L.DomEvent.stopPropagation(e)
            })

          // ポップアップの作成
          const popupContent = `
             <div class="p-2">
               <h3 class="font-bold text-sm mb-1">${getObstacleTypeName(obstacle.type)}</h3>
               <p class="text-xs text-gray-600 mb-1">${obstacle.description}</p>
               <div class="flex items-center gap-1">
                 <span class="text-xs px-2 py-1 rounded ${getDangerLevelBadgeColor(obstacle.dangerLevel)}">
                   ${getDangerLevelName(obstacle.dangerLevel)}
                 </span>
               </div>
             </div>
           `
          marker.bindPopup(popupContent)
        })
      }

      // ルート情報表示
      if (routeData.trip?.summary) {
        const summary = routeData.trip.summary
        const totalTime = Math.round(summary.time / 60) // 分に変換
        const totalDistance = summary.length.toFixed(1) // km

        console.log(`ルート情報: ${totalDistance}km, ${totalTime}分, 障害物: ${routeData.obstacles?.length || 0}個`)
      }

    } catch (error) {
      console.error("Failed to display route:", error)
    }
  }, [mapReady, routeData])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.off()
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '600px' }}
      />

      {/* Leaflet読み込み中 */}
      {!mapReady && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">地図を読み込み中...</span>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm">ルートを検索中...</span>
            </div>
          </div>
        </div>
      )}
      {clickMode && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg z-[1000]">
          <div className="text-sm font-medium">
            {clickMode === 'start' ? '🎯 出発地点を選択中' : '🎯 目的地を選択中'}
          </div>
          <div className="text-xs mt-1">地図をクリックしてください</div>
        </div>
      )}

      {/* デバッグ情報 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 bg-black text-white px-2 py-1 rounded text-xs z-[1000]">
          Mode: {clickMode || 'none'} | Ready: {mapReady ? 'yes' : 'no'}
        </div>
      )}
      {routeData && !clickMode && (
        <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg max-w-xs">
          <h3 className="font-bold text-sm mb-2">ルート情報</h3>
          <div className="text-xs space-y-1">
            <div>距離: {routeData.trip?.summary?.length?.toFixed(1)}km</div>
            <div>時間: {Math.round((routeData.trip?.summary?.time || 0) / 60)}分</div>
            <div className="text-red-600 font-medium">
              障害物: {routeData.obstacles?.length || 0}個
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Note: decodePolyline function moved to utils/polyline.ts

function getDangerLevelColor(level: number): string {
  switch (level) {
    case DangerLevel.LOW:
      return "bg-yellow-500"
    case DangerLevel.MEDIUM:
      return "bg-orange-500"
    case DangerLevel.HIGH:
      return "bg-red-500"
    default:
      return "bg-gray-500"
  }
}

function getDangerLevelBadgeColor(level: number): string {
  switch (level) {
    case DangerLevel.LOW:
      return "bg-yellow-100 text-yellow-800"
    case DangerLevel.MEDIUM:
      return "bg-orange-100 text-orange-800"
    case DangerLevel.HIGH:
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getDangerLevelName(level: number): string {
  switch (level) {
    case DangerLevel.LOW:
      return "低"
    case DangerLevel.MEDIUM:
      return "中"
    case DangerLevel.HIGH:
      return "高"
    default:
      return "不明"
  }
}

function getObstacleTypeIcon(type: number): string {
  switch (type) {
    case ObstacleType.BLOCK_WALL:
      return "🧱"
    case ObstacleType.VENDING_MACHINE:
      return "🥤"
    case ObstacleType.STAIRS:
      return "📶"
    case ObstacleType.STEEP_SLOPES:
      return "⛰️"
    case ObstacleType.NARROW_ROADS:
      return "↔️"
    case ObstacleType.OTHER:
      return "⚠️"
    default:
      return "❓"
  }
}

function getObstacleTypeName(type: number): string {
  switch (type) {
    case ObstacleType.BLOCK_WALL:
      return "ブロック・壁"
    case ObstacleType.VENDING_MACHINE:
      return "自動販売機"
    case ObstacleType.STAIRS:
      return "階段"
    case ObstacleType.STEEP_SLOPES:
      return "急勾配"
    case ObstacleType.NARROW_ROADS:
      return "狭い道路"
    case ObstacleType.OTHER:
      return "その他"
    default:
      return "不明"
  }
} 