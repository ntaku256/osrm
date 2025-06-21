// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { type Obstacle, DangerLevel, ObstacleType } from "@/types/obstacle"
import type { MapMode } from "@/app/content"

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
  mode: MapMode
  obstacles: Obstacle[]
  onMapClick: (position: [number, number]) => void
  selectedPosition: [number, number] | null
  selectedObstacle: Obstacle | null
  onObstacleSelect: (obstacle: Obstacle | null) => void
  highlightedPolyline?: [number, number][] | null
  highlightedNode?: [number, number] | null
  nearestRoadLocation?: [number, number] | null
}

export default function ObstacleMap({
  mode,
  obstacles,
  onMapClick,
  selectedPosition,
  selectedObstacle,
  onObstacleSelect,
  highlightedPolyline,
  highlightedNode,
  nearestRoadLocation,
}: ObstacleMapProps) {
  const mapRef = useRef(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef(null)
  const highlightLayerRef = useRef(null)
  const tempMarkerRef = useRef(null)
  const obstacleMarkersRef = useRef(new Map())
  const geoJsonLayerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapCenter] = useState<[number, number]>([33.881292, 135.157809])
  const [mapZoom] = useState<number>(16)
  const [showGeoJson, setShowGeoJson] = useState(false)
  const [isLoadingGeoJson, setIsLoadingGeoJson] = useState(false)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [areaDetails, setAreaDetails] = useState<Record<string, any> | null>(null)

  // modeの最新値を参照するためのref
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

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

        L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
          attribution: '地図データ：<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
          maxZoom: 18,
          minZoom: 5,
        }).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        highlightLayerRef.current = L.layerGroup().addTo(map)

        map.on("click", (e) => {
          if (modeRef.current === "create") {
            const { lat, lng } = e.latlng
            onMapClick([lat, lng])
          }
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

  // GeoJSONレイヤーの読み込みと表示/非表示の切り替え
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    const toggleGeoJsonLayer = async () => {
      try {
        // すでにレイヤーが存在する場合は削除
        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.remove()
          geoJsonLayerRef.current = null
        }

        // 選択エリアをリセット
        setSelectedArea(null)
        setAreaDetails(null)

        if (showGeoJson) {
          setIsLoadingGeoJson(true)

          // GeoJSONファイルを読み込む
          const response = await fetch('/gsi20250522123852657.geojson')
          const geoJsonData = await response.json()

          // GeoJSONレイヤーを作成して地図に追加
          const geoJsonLayer = L.geoJSON(geoJsonData, {
            style: (feature) => {
              // GeoJSONファイル内のスタイル設定を使用する（存在する場合）
              const props = feature.properties || {}
              return {
                color: props._color || '#3388ff',
                weight: props._weight || 3,
                opacity: props._opacity || 0.7,
                fillColor: props._fillColor || '#3388ff',
                fillOpacity: props._fillOpacity || 0.2
              }
            },
            onEachFeature: (feature, layer) => {
              if (feature.properties) {
                // 表示用のプロパティを抽出（スタイル設定は除外）
                const displayProps = Object.entries(feature.properties)
                  .filter(([key]) => !key.startsWith('_'))
                  .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                  .join('<br>')

                if (displayProps) {
                  layer.bindPopup(displayProps)
                }

                // クリックイベントを追加
                layer.on({
                  click: (e) => {
                    L.DomEvent.stopPropagation(e)
                    const props = feature.properties || {}
                    setSelectedArea(props.name || "不明なエリア")

                    // スタイル設定を除外したプロパティを詳細として保存
                    const details = Object.fromEntries(
                      Object.entries(props).filter(([key]) => !key.startsWith('_'))
                    )
                    setAreaDetails(details)
                  },
                  // ホバー時のハイライト
                  mouseover: (e) => {
                    const layer = e.target
                    layer.setStyle({
                      weight: 5,
                      opacity: 1.0,
                      fillOpacity: 0.4
                    })
                    layer.bringToFront()
                  },
                  mouseout: (e) => {
                    geoJsonLayer.resetStyle(e.target)
                  }
                })
              }
            }
          }).addTo(mapRef.current)

          geoJsonLayerRef.current = geoJsonLayer
          setIsLoadingGeoJson(false)
        }
      } catch (error) {
        console.error("Failed to toggle GeoJSON layer:", error)
        setIsLoadingGeoJson(false)
      }
    }

    toggleGeoJsonLayer()
  }, [showGeoJson, mapReady])

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
          (selectedObstacle.createdAt || '') === (obstacle.createdAt || '')

        // 選択状態に応じたマーカーアイコンを作成
        const markerIcon = L.divIcon({
          className: "obstacle-marker",
          html: `<div class="w-6 h-6 rounded-full flex items-center justify-center text-white ${isSelected
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
          title: getObstacleType(obstacle.type),
          alt: `障害物: ${ObstacleType[obstacle.type]}`,
          interactive: modeRef.current !== "create",
        })

        marker.off("click"); // 既存のクリックイベントを必ず解除
        // modeがcreate以外のときだけクリックイベントを登録
        if (modeRef.current !== "create") {
          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e)
            onObstacleSelect(obstacle)
          })
        }

        // ダウンスケールの問題を避けるため、ポップアップではなくツールチップを使用
        marker.bindTooltip(
          `<div>
            <strong>${getObstacleType(obstacle.type)}</strong><br>
            ${obstacle.description}
          </div>`,
          { direction: "top", offset: [0, -5] }
        )

        marker.addTo(markersLayerRef.current!)
        obstacleMarkersRef.current.set(
          `${obstacle.position[0]}-${obstacle.position[1]}-${obstacle.createdAt || 'no-date'}`,
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

      // ハイライトpolylineの描画
      if (highlightedPolyline && highlightedPolyline.length > 1) {
        L.polyline(highlightedPolyline, {
          color: 'orange',
          weight: 7,
          opacity: 0.8,
          dashArray: '8,6',
        }).addTo(highlightLayerRef.current)
      }

      // ノードのハイライト
      if (highlightedNode) {
        L.circleMarker(highlightedNode, {
          color: 'red',
          radius: 10,
          weight: 3,
          fillColor: 'yellow',
          fillOpacity: 0.8,
        }).addTo(highlightLayerRef.current)
      }

      // 最寄り道路の位置にマーカーを表示
      if (nearestRoadLocation) {
        const roadIcon = L.divIcon({
          className: "nearest-road-marker",
          html: `<div class="w-4 h-4 rounded-full flex items-center justify-center text-white bg-green-500 border-2 border-white shadow-md">🛣️</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        const roadMarker = L.marker(nearestRoadLocation, {
          icon: roadIcon,
          zIndexOffset: 500,
        })

        roadMarker.bindTooltip("最寄り道路", {
          direction: "top",
          offset: [0, -8],
          className: "road-tooltip"
        })

        roadMarker.addTo(highlightLayerRef.current)
      }
    } catch (error) {
      console.error("Failed to update selection:", error)
    }
  }, [selectedPosition, mapReady, highlightedPolyline, highlightedNode, nearestRoadLocation])

  // 選択された障害物が変更されたときにマップを更新
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedObstacle) return

    try {
      // マップを選択された障害物の位置に移動（ズームレベルは変更しない）
      mapRef.current.panTo(selectedObstacle.position)

      // マーカーを更新して選択状態を反映
      obstacles.forEach((obstacle) => {
        const isSelected =
          selectedObstacle.position[0] === obstacle.position[0] &&
          selectedObstacle.position[1] === obstacle.position[1] &&
          (selectedObstacle.createdAt || '') === (obstacle.createdAt || '')

        if (isSelected) {
          const markerKey = `${obstacle.position[0]}-${obstacle.position[1]}-${obstacle.createdAt || 'no-date'}`
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

  return (
    <div className="space-y-4">
      {/* マップコントロールパネル */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setShowGeoJson(!showGeoJson)}
            disabled={isLoadingGeoJson}
            className={`px-4 py-2 rounded-md shadow-sm transition-all ${isLoadingGeoJson ? 'bg-gray-400 text-white cursor-not-allowed' :
              showGeoJson
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-100'
              }`}
          >
            {isLoadingGeoJson ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                読み込み中...
              </span>
            ) : (
              showGeoJson ? 'GeoJSON非表示' : 'GeoJSON表示'
            )}
          </button>

          {/* 選択されたエリアの詳細情報 */}
          {showGeoJson && selectedArea && areaDetails && (
            <h3 className="font-medium text-black text-lg">エリア {selectedArea} </h3>
          )}
        </div>
      </div>

      {/* マップ */}
      <div className="relative">
        <div ref={mapContainerRef} className="h-[600px] rounded-lg overflow-hidden relative z-0"></div>
      </div>
    </div>
  )
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

// 障害物タイプに応じたアイコンを返す
function getObstacleType(type: ObstacleType): string {
  switch (type) {
    case ObstacleType.BLOCK_WALL:
      return "ブロック塀"
    case ObstacleType.VENDING_MACHINE:
      return "自動販売機"
    case ObstacleType.STAIRS:
      return "階段"
    case ObstacleType.STEEP_SLOPES:
      return "急な坂"
    case ObstacleType.NARROW_ROADS:
      return "↔狭い道"
    case ObstacleType.OTHER:
      return "その他"
    default:
      return "•"
  }
}
