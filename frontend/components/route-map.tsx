// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { RouteResponse } from "@/types/route"
import { DangerLevel, ObstacleType } from "@/types/obstacle"
import { decodePolyline, testDecodeWithBothPrecisions } from "@/utils/polyline"
import React from "react"

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
  selectedRouteIndex?: number
  isLoading: boolean
  startPosition: [number, number] | null
  endPosition: [number, number] | null
  onMapClick: (position: [number, number], mode: 'start' | 'end' | 'waypoint' | 'exclude') => void
  clickMode?: 'start' | 'end' | 'waypoint' | 'exclude' | null
  currentPosition?: [number, number] | null
  trackPoints?: [number, number][]
  isRecording?: boolean
  waypoints?: [number, number][]
  excludeLocations?: [number, number][]
  selectedObstacle?: number | null
  onAddToExcludeList?: (position: [number, number]) => void
}

export default function RouteMap({
  routeData,
  selectedRouteIndex = 0,
  isLoading,
  startPosition,
  endPosition,
  onMapClick,
  clickMode,
  currentPosition,
  trackPoints = [],
  isRecording = false,
  waypoints = [],
  excludeLocations = [],
  selectedObstacle = null,
  onAddToExcludeList,
}: RouteMapProps) {
  // 選択されたルートを取得するヘルパー関数
  const getSelectedRoute = () => {
    if (!routeData) return null;
    if (selectedRouteIndex === 0) return routeData.trip;
    if (
      routeData.alternates &&
      routeData.alternates.length > selectedRouteIndex - 1
    ) {
      return routeData.alternates[selectedRouteIndex - 1]?.trip;
    }
    return null;
  };
  const mapRef = useRef(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const routeLayerRef = useRef(null)
  const markersLayerRef = useRef(null)
  const obstacleMarkersRef = useRef(null)
  const trackLayerRef = useRef(null)
  const currentPositionMarkerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapCenter] = useState<[number, number]>([33.881292, 135.157809])
  const [zoom, setZoom] = useState(14)

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
          zoom: zoom,
          zoomControl: false,
          scrollWheelZoom: false,
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

          if (clickModeRef.current === 'start' || clickModeRef.current === 'end' || 
              clickModeRef.current === 'waypoint' || clickModeRef.current === 'exclude') {
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
  }, [mapCenter, zoom, onMapClick])

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
        dashArray: isRecording ? undefined : '5, 5',
        interactive: false  // クリックイベントを無効化
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
        html: `<div class=\"w-[24px] h-[24px] bg-green-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg text-xs\">S</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
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
        html: `<div class=\"w-[24px] h-[24px] bg-red-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg text-xs\">E</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      L.marker(endPosition, { icon: endIcon })
        .addTo(markersLayerRef.current)
        .bindPopup("目的地")
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
        })
    }

    // 中継地点マーカー
    waypoints.forEach((waypoint, index) => {
      const waypointIcon = L.divIcon({
        className: "route-marker",
        html: `<div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg">${index + 1}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      L.marker(waypoint, { icon: waypointIcon })
        .addTo(markersLayerRef.current)
        .bindPopup(`中継地点 ${index + 1}`)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
        })
    })

    // 回避地点マーカー
    excludeLocations.forEach((exclude, index) => {
      const excludeIcon = L.divIcon({
        className: "route-marker",
        html: `<div class="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg">×</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      L.marker(exclude, { icon: excludeIcon })
        .addTo(markersLayerRef.current)
        .bindPopup(`回避地点 ${index + 1}`)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
        })
    })
  }, [mapReady, startPosition, endPosition, waypoints, excludeLocations])

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
      // すべてのルート（メイン＋alternates）を配列化
      const allTrips = [routeData.trip, ...(routeData.alternates?.map(a => a.trip) ?? [])];
      let allRouteBounds = [];
      allTrips.forEach((trip, idx) => {
        if (trip && Array.isArray(trip.legs)) {
          trip.legs.forEach((leg) => {
            if (leg.shape) {
              const coordinates = decodePolyline(leg.shape, 6)
              // 座標が日本の範囲内かチェック
              const isInJapanRange = coordinates.every(([lat, lng]) =>
                lat >= 20 && lat <= 46 && lng >= 123 && lng <= 146
              )
              // もし精度6で範囲外なら精度5を試す
              if (!isInJapanRange && coordinates.length > 0) {
                const coordinatesPrecision5 = decodePolyline(leg.shape, 5)
                const isInJapanRangeP5 = coordinatesPrecision5.every(([lat, lng]) =>
                  lat >= 20 && lat <= 46 && lng >= 123 && lng <= 146
                )
                if (isInJapanRangeP5) {
                  coordinates.length = 0
                  coordinates.push(...coordinatesPrecision5)
                }
              }
              // ルートライン
              const isSelected = idx === selectedRouteIndex;
              const routeLine = L.polyline(coordinates, {
                color: isSelected ? '#3388ff' : '#94a3b8',
                weight: isSelected ? 6 : 4,
                opacity: isSelected ? 0.8 : 0.5,
                interactive: false
              }).addTo(routeLayerRef.current)
              allRouteBounds.push(...coordinates)
              // ルート番号ピン（詳細付き）
              if (coordinates.length > 0) {
                const midIdx = Math.floor(coordinates.length / 2)
                const midPoint = coordinates[midIdx]
                const summary = trip.summary
                const popupContent = `
                  <div style=\"min-width:180px;\">
                    <div style=\"font-weight:bold;\">ルート${idx + 1}</div>
                    <div>距離: ${summary?.length?.toFixed(1) ?? '-'} km</div>
                    <div>時間: ${summary?.time ? Math.round(summary.time / 60) : '-'} 分</div>
                    <div style='margin-top:4px;font-size:11px;max-width:300px;overflow-wrap:break-word;'><b>Shape:</b><br><code>${leg.shape}</code></div>
                  </div>
                `
                const labelIcon = L.divIcon({
                  html: `<div style=\"background:${isSelected ? '#3388ff' : '#94a3b8'};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow:0 2px 6px #0002;\">${idx + 1}</div>`
                  ,
                  className: "route-number-label",
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })
                const marker = L.marker(midPoint, { icon: labelIcon }).addTo(routeLayerRef.current)
                marker.bindPopup(popupContent)
                marker.on('click', (e) => {
                  if (e.originalEvent) {
                    L.DomEvent.stopPropagation(e)
                  }
                })
              }
            }
          })
        }
      })
      // 全ルートの境界にマップをフィット
      if (allRouteBounds.length > 0) {
        const bounds = L.latLngBounds(allRouteBounds)
        mapRef.current.fitBounds(bounds, { padding: [20, 20] })
        setZoom(mapRef.current.getZoom())
      }
      // 障害物マーカーの表示（選択中ルートのみ）
      const selectedTrip = allTrips[selectedRouteIndex];
      if (selectedTrip?.obstacles && selectedTrip.obstacles.length > 0) {
        selectedTrip.obstacles.forEach((obstacle) => {
          const isSelected = selectedObstacle === obstacle.id
          const obstacleIcon = L.divIcon({
            className: "obstacle-marker",
            html: `<div class=\"w-[28px] h-[28px] rounded-full flex items-center justify-center text-white border-2 ${isSelected ? 'border-yellow-400 shadow-2xl animate-bounce' : 'border-white shadow-lg animate-pulse'} ${getDangerLevelColor(obstacle.dangerLevel)} ${isSelected ? 'ring-4 ring-yellow-400 ring-opacity-50' : ''}\">${getObstacleTypeIcon(obstacle.type)}</div>`,
            iconSize: isSelected ? [34, 34] : [28, 28],
            iconAnchor: isSelected ? [17, 17] : [14, 14],
          })
          const marker = L.marker(obstacle.position, { icon: obstacleIcon })
            .addTo(obstacleMarkersRef.current)
            .on('click', (e) => {
              L.DomEvent.stopPropagation(e)
            })
          // 回避地点に既に追加されているかチェック
          const isAlreadyExcluded = excludeLocations.some(loc => 
            Math.abs(loc[0] - obstacle.position[0]) < 0.0001 && 
            Math.abs(loc[1] - obstacle.position[1]) < 0.0001
          )
          // ポップアップの作成
          const popupContent = `
             <div class=\"p-3\">
               <h3 class=\"font-bold text-sm mb-1\">${getObstacleTypeName(obstacle.type)}</h3>
               <p class=\"text-xs text-gray-700 mb-2\">${obstacle.description}</p>
               <div class=\"flex items-center gap-1 mb-2\">
                 <span class=\"text-xs px-2 py-1 rounded ${getDangerLevelBadgeColor(obstacle.dangerLevel)}\">${getDangerLevelName(obstacle.dangerLevel)}</span>
               </div>
               ${isSelected ? '<p class="text-xs text-yellow-600 font-medium mb-2">📍 選択中の障害物</p>' : ''}
               <p class=\"text-xs text-gray-500 mb-2\">座標: ${obstacle.position[0].toFixed(6)}, ${obstacle.position[1].toFixed(6)}</p>
               <button 
                 id=\"exclude-btn-${obstacle.id}\" 
                 class=\"w-full px-2 py-1 text-xs rounded border transition-colors ${isAlreadyExcluded ? 'bg-green-100 text-green-700 border-green-300 cursor-not-allowed' : 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:text-orange-800'}\"${isAlreadyExcluded ? ' disabled' : ''}>
                 ${isAlreadyExcluded ? '回避地点に追加済み' : '回避地点に追加'}
               </button>
             </div>
           `
          const popup = L.popup().setContent(popupContent)
          marker.bindPopup(popup)
          marker.on('popupopen', () => {
            const excludeBtn = document.getElementById(`exclude-btn-${obstacle.id}`)
            if (excludeBtn && !isAlreadyExcluded && onAddToExcludeList) {
              excludeBtn.addEventListener('click', () => {
                onAddToExcludeList(obstacle.position)
                excludeBtn.textContent = '回避地点に追加済み'
                excludeBtn.className = 'w-full px-2 py-1 text-xs rounded border bg-green-100 text-green-700 border-green-300 cursor-not-allowed'
                excludeBtn.setAttribute('disabled', 'true')
              })
            }
          })
          if (isSelected) {
            marker.openPopup()
          }
        })
      }

      // ルート情報表示
      const selectedRoute = getSelectedRoute()
      if (selectedRoute?.summary) {
        const summary = selectedRoute.summary
        const totalTime = Math.round(summary.time / 60) // 分に変換
        const totalDistance = summary.length.toFixed(1) // km

        console.log(`ルート情報: ${totalDistance}km, ${totalTime}分, 障害物: ${routeData.obstacles?.length || 0}個`)
      }

    } catch (error) {
      console.error("Failed to display route:", error)
    }
  }, [mapReady, routeData, selectedObstacle, selectedRouteIndex])

  // ズームバーで地図のズームを変更
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // 地図のズーム変更時にズームバーも同期
  useEffect(() => {
    if (!mapRef.current) return;
    const onZoom = () => setZoom(mapRef.current.getZoom());
    mapRef.current.on("zoomend", onZoom);
    return () => {
      mapRef.current && mapRef.current.off("zoomend", onZoom);
    };
  }, [mapReady]);

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
        className="w-full h-full rounded-lg overflow-hidden bg-gray-100 z-0"
        style={{ minHeight: '800px' }}
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
            {clickMode === 'start' ? '🎯 出発地点を選択中' : clickMode === 'end' ? '🎯 目的地を選択中' : clickMode === 'waypoint' ? '🎯 ウェイトポイントを選択中' : '🎯 除外地点を選択中'}
          </div>
          <div className="text-xs mt-1">地図をクリックしてください</div>
        </div>
      )}

      {/* デバッグ情報 */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 bg-black text-white px-2 py-1 rounded text-xs z-[1000]">
          Mode: {clickMode || 'none'} | Ready: {mapReady ? 'yes' : 'no'} | Selected: {selectedObstacle || 'none'}
        </div>
      )} */}
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

      <div className="flex items-center gap-2 mt-2 absolute left-1/2 -translate-x-1/2 bottom-4 z-0 bg-white bg-opacity-80 rounded px-3 py-2 shadow">
        <span className="text-black">ズーム</span>
        <input
          type="range"
          min={5}
          max={18}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          onWheel={e => { e.preventDefault(); }}
          className="w-48 text-black"
          style={{ touchAction: "none" }}
        />
        <span className="text-black">{zoom}</span>
      </div>
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