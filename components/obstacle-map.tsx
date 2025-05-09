"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { type Obstacle, DangerLevel, ObstacleType } from "@/types/obstacle"
import { decodePolyline, getRoutesAroundPoint } from "@/utils/osrm"

// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/marker-icon-2x.png",
    iconUrl: "/marker-icon.png",
    shadowUrl: "/marker-shadow.png",
  })
}

interface ObstacleMapProps {
  obstacles: Obstacle[]
  onMapClick: (position: [number, number]) => void
  selectedPosition: [number, number] | null
  selectedObstacle: Obstacle | null
  onObstacleSelect: (obstacle: Obstacle | null) => void
  onRoutesFound?: (routes: any[]) => void
}

export default function ObstacleMap({
  obstacles,
  onMapClick,
  selectedPosition,
  selectedObstacle,
  onObstacleSelect,
  onRoutesFound,
}: ObstacleMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const routesLayerRef = useRef<L.LayerGroup | null>(null)
  const availableRoutesLayerRef = useRef<L.LayerGroup | null>(null)
  const highlightLayerRef = useRef<L.LayerGroup | null>(null)
  const tempMarkerRef = useRef<L.Marker | null>(null)
  const obstacleMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [mapCenter] = useState<[number, number]>([35.6812, 139.7671])
  const [mapZoom] = useState<number>(13)
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)

  // マップの初期化
  useEffect(() => {
    // マップが既に初期化されている場合は何もしない
    if (mapRef.current || !mapContainerRef.current) return

    // Leafletのアイコン問題を修正
    fixLeafletIcon()

    // マップの初期化を遅延させて、DOMが確実に準備できるようにする
    const initializeMap = () => {
      if (!mapContainerRef.current) return

      try {
        const map = L.map(mapContainerRef.current, {
          center: mapCenter,
          zoom: mapZoom,
          // ズームコントロールを無効化（エラーの原因になることがある）
          zoomControl: false,
        })

        // ズームコントロールを別途追加（位置を指定）
        L.control.zoom({ position: "topright" }).addTo(map)

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        routesLayerRef.current = L.layerGroup().addTo(map)
        availableRoutesLayerRef.current = L.layerGroup().addTo(map)
        highlightLayerRef.current = L.layerGroup().addTo(map)

        map.on("click", (e) => {
          const { lat, lng } = e.latlng
          onMapClick([lat, lng])
          // 地図をクリックしたときに選択を解除
          onObstacleSelect(null)
        })

        mapRef.current = map
        setMapReady(true)

        // マップのサイズを更新（レンダリング問題を防ぐ）
        setTimeout(() => {
          map.invalidateSize()
        }, 100)
      } catch (error) {
        console.error("Failed to initialize map:", error)
      }
    }

    // 少し遅延させてマップを初期化
    const timer = setTimeout(initializeMap, 100)
    return () => clearTimeout(timer)
  }, [mapCenter, mapZoom, onMapClick, onObstacleSelect])

  // マップのクリーンアップ
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        // イベントリスナーを削除
        mapRef.current.off()
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
  }, [])

  // 選択位置が変更されたときに周辺の経路を取得
  useEffect(() => {
    if (!mapReady || !selectedPosition || !availableRoutesLayerRef.current) return

    const fetchRoutesAroundPoint = async () => {
      setIsLoadingRoutes(true)
      availableRoutesLayerRef.current?.clearLayers()

      try {
        const { routes, error } = await getRoutesAroundPoint(selectedPosition)

        if (error) {
          console.warn("Error fetching routes:", error)
        }

        if (routes.length > 0) {
          // 経路を地図に表示
          routes.forEach((route, index) => {
            const points = decodePolyline(route.geometry)
            if (points && points.length > 1) {
              // 経路ごとに異なる色を使用
              const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
              const color = colors[index % colors.length]

              const polyline = L.polyline(points, {
                color,
                weight: 4,
                opacity: 0.7,
                lineJoin: "round",
              })

              // 経路の情報をポップアップに表示
              polyline.bindPopup(`
                <div>
                  <h3 class="font-bold">${route.direction}</h3>
                  <p>距離: ${(route.distance / 1000).toFixed(2)} km</p>
                  <p>所要時間: ${Math.round(route.duration / 60)} 分</p>
                </div>
              `)

              polyline.addTo(availableRoutesLayerRef.current!)
            }
          })

          // 親コンポーネントに経路情報を通知
          if (onRoutesFound) {
            onRoutesFound(routes)
          }
        }
      } catch (error) {
        console.error("Failed to fetch routes around point:", error)
      } finally {
        setIsLoadingRoutes(false)
      }
    }

    fetchRoutesAroundPoint()
  }, [selectedPosition, mapReady, onRoutesFound])

  // マーカーと経路の更新
  useEffect(() => {
    if (!mapReady || !mapRef.current || !markersLayerRef.current || !routesLayerRef.current) return

    try {
      markersLayerRef.current.clearLayers()
      routesLayerRef.current.clearLayers()
      obstacleMarkersRef.current.clear()

      obstacles.forEach((obstacle) => {
        // 障害物マーカーを追加
        const isSelected =
          selectedObstacle &&
          selectedObstacle.position[0] === obstacle.position[0] &&
          selectedObstacle.position[1] === obstacle.position[1] &&
          selectedObstacle.createdAt === obstacle.createdAt

        // 選択状態に応じたマーカーアイコンを作成
        const markerIcon = L.divIcon({
          className: "obstacle-marker",
          html: `<div class="w-6 h-6 rounded-full flex items-center justify-center text-white ${
            isSelected
              ? "bg-yellow-500 border-2 border-white shadow-lg transform scale-125"
              : getDangerLevelColor(obstacle.dangerLevel)
          }">
            ${getObstacleTypeIcon(obstacle.type)}
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        const marker = L.marker(obstacle.position, { icon: markerIcon })

        // ポップアップコンテンツを作成
        const popupContent = document.createElement("div")
        popupContent.innerHTML = `
          <div>
            <h3 class="font-bold">${ObstacleType[obstacle.type]}</h3>
            <p class="text-sm">危険度: ${DangerLevel[obstacle.dangerLevel]}</p>
            <p class="text-sm">${obstacle.description}</p>
            ${obstacle.routeInfo ? `<p class="text-sm">最寄り道路: ${obstacle.routeInfo.name || "名称なし"} (${obstacle.routeInfo.distance.toFixed(1)}m)</p>` : ""}
          </div>
        `

        marker.bindPopup(popupContent)

        // マーカーをクリックしたときに選択状態を切り替える
        marker.on("click", (e) => {
          // イベントの伝播を停止
          L.DomEvent.stopPropagation(e)

          // 選択状態を切り替え
          if (isSelected) {
            onObstacleSelect(null)
          } else {
            onObstacleSelect(obstacle)
          }
        })

        marker.addTo(markersLayerRef.current!)

        // マーカーを参照用に保存
        const obstacleKey = `${obstacle.position[0]}-${obstacle.position[1]}-${obstacle.createdAt}`
        obstacleMarkersRef.current.set(obstacleKey, marker)

        // 経路情報がある場合は表示（選択されていない場合は薄く表示）
        if (obstacle.routeLink) {
          try {
            // ポリラインをデコード
            const points = decodePolyline(obstacle.routeLink)

            if (points && points.length > 1) {
              // 経路を表示（選択状態に応じて色を変える）
              const polyline = L.polyline(points, {
                color: isSelected ? "#3b82f6" : "#93c5fd", // 選択時: blue-500, 非選択時: blue-300
                weight: isSelected ? 5 : 3,
                opacity: isSelected ? 0.9 : 0.5,
                lineJoin: "round",
              })

              polyline.addTo(routesLayerRef.current!)

              // 障害物から経路への接続線を表示
              const closestPointOnRoute = findClosestPointOnRoute(obstacle.position, points)
              if (closestPointOnRoute) {
                const connectionLine = L.polyline([obstacle.position, closestPointOnRoute], {
                  color: isSelected ? "#ef4444" : "#fca5a5", // 選択時: red-500, 非選択時: red-300
                  weight: isSelected ? 3 : 2,
                  opacity: isSelected ? 0.8 : 0.5,
                  dashArray: "5, 5",
                })
                connectionLine.addTo(routesLayerRef.current!)
              }
            }
          } catch (error) {
            console.error("Failed to process route:", error)
          }
        }
      })
    } catch (error) {
      console.error("Error updating markers:", error)
    }
  }, [obstacles, selectedObstacle, mapReady, onObstacleSelect])

  // 選択された障害物の強調表示
  useEffect(() => {
    if (!mapReady || !mapRef.current || !highlightLayerRef.current) return

    highlightLayerRef.current.clearLayers()

    if (selectedObstacle && selectedObstacle.routeLink) {
      try {
        // 選択された障害物の位置にズーム
        mapRef.current.setView(selectedObstacle.position, 15)

        // 経路を強調表示
        const points = decodePolyline(selectedObstacle.routeLink)

        if (points && points.length > 1) {
          // 経路の周りに半透明の強調表示を追加
          const highlightPolyline = L.polyline(points, {
            color: "#2563eb", // blue-600
            weight: 9,
            opacity: 0.3,
            lineJoin: "round",
            lineCap: "round",
          })

          highlightPolyline.addTo(highlightLayerRef.current)

          // 経路の始点と終点にマーカーを追加
          const startMarker = L.circleMarker(points[0], {
            radius: 6,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 1,
            weight: 2,
          })

          const endMarker = L.circleMarker(points[points.length - 1], {
            radius: 6,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 1,
            weight: 2,
          })

          startMarker.addTo(highlightLayerRef.current)
          endMarker.addTo(highlightLayerRef.current)
        }
      } catch (error) {
        console.error("Failed to highlight selected route:", error)
      }
    }
  }, [selectedObstacle, mapReady])

  // 一時的なマーカーの更新
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    try {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove()
        tempMarkerRef.current = null
      }

      if (selectedPosition) {
        tempMarkerRef.current = L.marker(selectedPosition, {
          icon: L.divIcon({
            className: "temp-marker",
            html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white">+</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(mapRef.current)

        // 選択位置に自動的にズーム
        mapRef.current.setView(selectedPosition, 15)
      }
    } catch (error) {
      console.error("Error updating temporary marker:", error)
    }
  }, [selectedPosition, mapReady])

  // マップのサイズを更新（ウィンドウサイズ変更時）
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize()
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <div className="relative">
      <div ref={mapContainerRef} className="h-[600px] rounded-lg border" />
      {isLoadingRoutes && (
        <div className="absolute top-2 right-2 bg-white px-3 py-2 rounded-md shadow-md text-sm flex items-center">
          <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          周辺の経路を取得中...
        </div>
      )}
    </div>
  )
}

/**
 * 経路上で指定した点に最も近い点を見つける
 * @param point 基準点 [lat, lng]
 * @param routePoints 経路の点の配列
 * @returns 最も近い点の座標
 */
function findClosestPointOnRoute(point: [number, number], routePoints: [number, number][]): [number, number] | null {
  if (!routePoints || routePoints.length === 0) return null

  let closestPoint = routePoints[0]
  let minDistance = getDistance(point, closestPoint)

  for (let i = 1; i < routePoints.length; i++) {
    const distance = getDistance(point, routePoints[i])
    if (distance < minDistance) {
      minDistance = distance
      closestPoint = routePoints[i]
    }
  }

  return closestPoint
}

/**
 * 2点間の距離を計算（簡易版）
 * @param p1 点1 [lat, lng]
 * @param p2 点2 [lat, lng]
 * @returns 距離（度単位）
 */
function getDistance(p1: [number, number], p2: [number, number]): number {
  const dx = p1[0] - p2[0]
  const dy = p1[1] - p2[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 危険度レベルに応じた色のクラスを返す
 */
function getDangerLevelColor(level: DangerLevel): string {
  switch (level) {
    case DangerLevel.LOW:
      return "bg-green-500 border border-green-600"
    case DangerLevel.MEDIUM:
      return "bg-yellow-500 border border-yellow-600"
    case DangerLevel.HIGH:
      return "bg-red-500 border border-red-600"
    default:
      return "bg-gray-500 border border-gray-600"
  }
}

/**
 * 障害物タイプに応じたアイコンを返す
 */
function getObstacleTypeIcon(type: ObstacleType): string {
  switch (type) {
    case ObstacleType.CONSTRUCTION:
      return "🚧"
    case ObstacleType.ROAD_DAMAGE:
      return "🕳️"
    case ObstacleType.FLOODING:
      return "💧"
    case ObstacleType.FALLEN_OBJECT:
      return "📦"
    case ObstacleType.NARROW_PATH:
      return "↔️"
    case ObstacleType.OTHER:
      return "❓"
    default:
      return "•"
  }
}
