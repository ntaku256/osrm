"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import ObstacleForm from "@/components/obstacle-form"
import { type Obstacle, ObstacleType, DangerLevel } from "@/types/obstacle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info, MapPin, Calendar } from "lucide-react"

// Dynamically import the map component to avoid SSR issues with Leaflet
const ObstacleMap = dynamic(() => import("@/components/obstacle-map"), {
  ssr: false,
  loading: () => <div className="h-[600px] bg-gray-100 flex items-center justify-center">地図を読み込み中...</div>,
})

export default function ObstacleMapContainer() {
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedObstacle, setSelectedObstacle] = useState<Obstacle | null>(null)
  const [availableRoutes, setAvailableRoutes] = useState<any[]>([])

  const handleMapClick = (position: [number, number]) => {
    setSelectedPosition(position)
    setIsFormOpen(true)
    // 新しい障害物を追加するときは選択状態をクリア
    setSelectedObstacle(null)
  }

  const handleObstacleSubmit = (obstacle: Obstacle) => {
    setObstacles([...obstacles, obstacle])
    setIsFormOpen(false)
    // 選択位置はクリアするが、地図の表示位置は保持する
    setSelectedPosition(null)
    // 利用可能な経路をクリア
    setAvailableRoutes([])
  }

  const handleFormCancel = () => {
    setIsFormOpen(false)
    setSelectedPosition(null)
    // 利用可能な経路をクリア
    setAvailableRoutes([])
  }

  const handleObstacleSelect = (obstacle: Obstacle | null) => {
    setSelectedObstacle(obstacle)
  }

  const handleRoutesFound = (routes: any[]) => {
    setAvailableRoutes(routes)
  }

  // 危険度に応じた色を返す関数
  const getDangerLevelColor = (level: DangerLevel): string => {
    switch (level) {
      case DangerLevel.LOW:
        return "bg-green-100 text-green-800 border-green-300"
      case DangerLevel.MEDIUM:
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case DangerLevel.HIGH:
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <ObstacleMap
          obstacles={obstacles}
          onMapClick={handleMapClick}
          selectedPosition={selectedPosition}
          selectedObstacle={selectedObstacle}
          onObstacleSelect={handleObstacleSelect}
          onRoutesFound={handleRoutesFound}
        />
      </div>
      <div>
        {isFormOpen && selectedPosition ? (
          <ObstacleForm
            position={selectedPosition}
            onSubmit={handleObstacleSubmit}
            onCancel={handleFormCancel}
            availableRoutes={availableRoutes}
          />
        ) : selectedObstacle ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>選択中の障害物</span>
                <Badge className={getDangerLevelColor(selectedObstacle.dangerLevel)}>
                  危険度: {DangerLevel[selectedObstacle.dangerLevel]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500 flex-shrink-0">
                  {getObstacleTypeIcon(selectedObstacle.type)}
                </div>
                <div>
                  <h3 className="font-medium">{ObstacleType[selectedObstacle.type]}</h3>
                  <p className="text-sm text-gray-500">{selectedObstacle.description}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span>
                    緯度: {selectedObstacle.position[0].toFixed(6)}, 経度: {selectedObstacle.position[1].toFixed(6)}
                  </span>
                </div>

                {selectedObstacle.routeInfo && (
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-gray-500" />
                    <span>
                      最寄り道路: {selectedObstacle.routeInfo.name}({selectedObstacle.routeInfo.distance.toFixed(1)}m)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>登録日時: {new Date(selectedObstacle.createdAt).toLocaleString("ja-JP")}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelectedObstacle(null)}>
                選択解除
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">登録済み障害物</h2>
            {obstacles.length > 0 ? (
              <ul className="space-y-2">
                {obstacles.map((obstacle, index) => (
                  <li
                    key={index}
                    className="border rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedObstacle(obstacle)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${getDangerLevelBg(obstacle.dangerLevel)}`}></div>
                      <div className="font-medium">{ObstacleType[obstacle.type]}</div>
                    </div>
                    <div className="text-sm text-gray-500">危険度: {DangerLevel[obstacle.dangerLevel]}</div>
                    <div className="text-sm truncate">{obstacle.description}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">地図上をクリックして障害物を登録してください</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 危険度に応じた背景色を返す関数
function getDangerLevelBg(level: DangerLevel): string {
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
