// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { type Obstacle, DangerLevel, ObstacleType } from "@/types/obstacle"

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
}

export default function ObstacleMap({
  obstacles,
  onMapClick,
  selectedPosition,
  selectedObstacle,
  onObstacleSelect,
}: ObstacleMapProps) {
  const mapRef = useRef(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef(null)
  const highlightLayerRef = useRef(null)
  const tempMarkerRef = useRef(null)
  const obstacleMarkersRef = useRef(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [mapCenter] = useState<[number, number]>([33.881292, 135.157809])
  const [mapZoom] = useState<number>(16)

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

  // マーカーの更新
  useEffect(() => {
    if (!mapReady || !mapRef.current || !markersLayerRef.current) return

    try {
      markersLayerRef.current.clearLayers()
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

        const marker = L.marker(obstacle.position, {
          icon: markerIcon,
          title: ObstacleType[obstacle.type],
          alt: `障害物: ${ObstacleType[obstacle.type]}`,
        })

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          onObstacleSelect(obstacle)
        })

        // ダウンスケールの問題を避けるため、ポップアップではなくツールチップを使用
        marker.bindTooltip(
          `<div>
            <strong>${ObstacleType[obstacle.type]}</strong><br>
            ${obstacle.description}
          </div>`,
          { direction: "top", offset: [0, -5] }
        )

        marker.addTo(markersLayerRef.current!)
        obstacleMarkersRef.current.set(
          `${obstacle.position[0]}-${obstacle.position[1]}-${obstacle.createdAt}`,
          marker
        )
      })
    } catch (error) {
      console.error("Failed to update markers:", error)
    }
  }, [obstacles, selectedObstacle, mapReady, onObstacleSelect])

  // 選択位置が変更されたときにマーカーを表示
  useEffect(() => {
    if (!mapReady || !mapRef.current || !highlightLayerRef.current) return

    try {
      highlightLayerRef.current.clearLayers()

      if (selectedPosition) {
        // 一時マーカーを追加
        if (tempMarkerRef.current) {
          tempMarkerRef.current.remove()
        }

        const icon = L.divIcon({
          className: "temp-marker",
          html: `<div class="w-6 h-6 rounded-full flex items-center justify-center text-white bg-blue-500 border-2 border-white pulse-animation">+</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        const marker = L.marker(selectedPosition, {
          icon,
          zIndexOffset: 1000,
        })

        marker.addTo(highlightLayerRef.current)
        tempMarkerRef.current = marker

        // 選択位置にマップをパン
        mapRef.current.panTo(selectedPosition)

        // ズームレベルが低すぎる場合はズームイン
        if (mapRef.current.getZoom() < 15) {
          mapRef.current.setView(selectedPosition, 16)
        }
      } else {
        if (tempMarkerRef.current) {
          tempMarkerRef.current.remove()
          tempMarkerRef.current = null
        }
      }
    } catch (error) {
      console.error("Failed to update selection:", error)
    }
  }, [selectedPosition, mapReady])

  // 選択された障害物が変更されたときにマップを更新
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedObstacle) return

    try {
      // マップを選択された障害物の位置に移動
      mapRef.current.setView(selectedObstacle.position, 17)

      // マーカーを更新して選択状態を反映
      obstacles.forEach((obstacle) => {
        const isSelected =
          selectedObstacle.position[0] === obstacle.position[0] &&
          selectedObstacle.position[1] === obstacle.position[1] &&
          selectedObstacle.createdAt === obstacle.createdAt

        if (isSelected) {
          const markerKey = `${obstacle.position[0]}-${obstacle.position[1]}-${obstacle.createdAt}`
          const marker = obstacleMarkersRef.current.get(markerKey)
          if (marker) {
            // マーカーアイコンを更新
            const markerIcon = L.divIcon({
              className: "obstacle-marker",
              html: `<div class="w-6 h-6 rounded-full flex items-center justify-center text-white bg-yellow-500 border-2 border-white shadow-lg transform scale-125">
                ${getObstacleTypeIcon(obstacle.type)}
              </div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })
            marker.setIcon(markerIcon)
            marker.openTooltip()
          }
        }
      })
    } catch (error) {
      console.error("Failed to handle obstacle selection:", error)
    }
  }, [selectedObstacle, obstacles, mapReady])

  // ウィンドウのリサイズに対応してマップのサイズを更新
  useEffect(() => {
    if (!mapRef.current) return

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

  return <div ref={mapContainerRef} className="h-[600px] rounded-lg overflow-hidden relative z-0"></div>
}

// 危険度に応じた色を返す関数
function getDangerLevelColor(level: DangerLevel): string {
  switch (level) {
    case DangerLevel.LOW:
      return "bg-green-500"
    case DangerLevel.MEDIUM:
      return "bg-yellow-500"
    case DangerLevel.HIGH:
      return "bg-red-500"
    default:
      return "bg-gray-500"
  }
}

// 障害物タイプに応じたアイコンを返す
function getObstacleTypeIcon(type: ObstacleType): string {
  switch (type) {
    case ObstacleType.BLOCK_WALL:
      return "🧱"
    case ObstacleType.VENDING_MACHINE:
      return "🥤"
    case ObstacleType.STAIRS:
      return "🪜"
    case ObstacleType.STEEP_SLOPES:
      return "⛰️"
    case ObstacleType.NARROW_ROADS:
      return "↔️"
    case ObstacleType.OTHER:
      return "❓"
    default:
      return "•"
  }
}
