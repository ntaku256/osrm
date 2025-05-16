"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import ObstacleForm from "@/components/obstacle-form"
import ObstacleEditForm from "@/components/obstacle-edit-form"
import { type Obstacle, ObstacleType, DangerLevel } from "@/types/obstacle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Calendar, Trash2, Edit } from "lucide-react"
import { obstacleApi } from "@/utils/api"
import { useToast } from "@/components/ui/use-toast"
import { getNearestRoad } from "@/utils/osrm"

// Update Obstacle type to include id for API interaction
interface ExtendedObstacle extends Obstacle {
  id?: number;
}

// Dynamically import the map component to avoid SSR issues with Leaflet
const ObstacleMap = dynamic(() => import("@/components/obstacle-map"), {
  ssr: false,
  loading: () => <div className="h-[600px] bg-gray-100 flex items-center justify-center">地図を読み込み中...</div>,
})

export default function ObstacleMapContainer() {
  const [obstacles, setObstacles] = useState<ExtendedObstacle[]>([])
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)
  const [selectedObstacle, setSelectedObstacle] = useState<ExtendedObstacle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const [nearestRoad, setNearestRoad] = useState<any | null>(null)
  const [highlightedPolyline, setHighlightedPolyline] = useState<[number, number][] | null>(null)
  const [highlightedNode, setHighlightedNode] = useState<[number, number] | null>(null)
  const [highlightedSegmentDistance, setHighlightedSegmentDistance] = useState<number | null>(null)

  // Fetch obstacles on component mount
  useEffect(() => {
    const fetchObstacles = async () => {
      setIsLoading(true);
      try {
        const response = await obstacleApi.getAll();
        if (!response.error && response.data) {
          setObstacles(response.data);
        } else if (response.error) {
          toast({
            title: "エラー",
            description: "障害物の取得に失敗しました: " + response.error,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Failed to fetch obstacles:", error);
        toast({
          title: "エラー",
          description: "障害物の取得中にエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchObstacles();
  }, [toast]);

  const handleMapClick = async (position: [number, number]) => {
    setSelectedPosition(position)
    setIsFormOpen(true)
    setSelectedObstacle(null)
    setNearestRoad(null)
    setHighlightedPolyline(null)
    setHighlightedNode(null)
    setHighlightedSegmentDistance(null)

    const nearest = await getNearestRoad(position)
    setNearestRoad(nearest)
    if (nearest && nearest.location) {
      setHighlightedNode(nearest.location)
    }
  }

  const handleObstacleSubmit = (newObstacle: Obstacle) => {
    setIsFormOpen(false)
    setSelectedPosition(null)
    
    // Add the new obstacle to the list
    const extendedObstacle: ExtendedObstacle = {
      ...newObstacle,
      // The API might have assigned an id if it was created via the API
    };
    setObstacles(prev => [...prev, extendedObstacle])
  }

  const handleObstacleUpdate = (updatedObstacle: ExtendedObstacle) => {
    setIsEditFormOpen(false)
    
    // Update the obstacle in the list
    setObstacles(prev => 
      prev.map(o => o.id === updatedObstacle.id ? updatedObstacle : o)
    )
    
    // Update the selected obstacle with new data
    setSelectedObstacle(updatedObstacle)
  }

  const handleFormCancel = () => {
    setIsFormOpen(false)
    setSelectedPosition(null)
  }

  const handleEditCancel = () => {
    setIsEditFormOpen(false)
  }

  const handleEditClick = () => {
    setIsEditFormOpen(true)
  }

  const handleObstacleSelect = async (obstacle: ExtendedObstacle | null) => {
    setSelectedObstacle(obstacle)
    setIsEditFormOpen(false)
    setHighlightedPolyline(null)
    setHighlightedNode(null)
    setHighlightedSegmentDistance(null)
    if (obstacle) {
      const nearest = await getNearestRoad(obstacle.position)
      if (nearest && nearest.location) {
        setHighlightedNode(nearest.location)
      }
    }
  }

  const handleDeleteObstacle = async () => {
    if (!selectedObstacle || !selectedObstacle.id) {
      toast({
        title: "エラー",
        description: "この障害物は削除できません (IDが見つかりません)",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await obstacleApi.delete(selectedObstacle.id);
      if (!response.error) {
        setObstacles(obstacles.filter(o => o.id !== selectedObstacle.id));
        setSelectedObstacle(null);
        toast({
          title: "削除完了",
          description: "障害物が正常に削除されました",
        });
      } else {
        toast({
          title: "エラー",
          description: "障害物の削除に失敗しました: " + response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete obstacle:", error);
      toast({
        title: "エラー",
        description: "障害物の削除中にエラーが発生しました",
        variant: "destructive",
      });
    }
  };

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
        {isLoading ? (
          <div className="h-[600px] bg-gray-100 flex items-center justify-center">障害物データを読み込み中...</div>
        ) : (
          <ObstacleMap
            obstacles={obstacles}
            onMapClick={handleMapClick}
            selectedPosition={selectedPosition}
            selectedObstacle={selectedObstacle}
            onObstacleSelect={handleObstacleSelect}
            highlightedPolyline={highlightedPolyline}
            highlightedNode={highlightedNode}
          />
        )}
        {highlightedSegmentDistance && (
          <div className="p-2 bg-orange-50 rounded text-sm text-orange-900 border border-orange-200 mb-2">
            区間の長さ: {highlightedSegmentDistance.toFixed(1)} m
          </div>
        )}
      </div>
      <div>
        {isFormOpen && selectedPosition ? (
          <ObstacleForm
            position={selectedPosition}
            nearestRoad={nearestRoad}
            onSubmit={handleObstacleSubmit}
            onCancel={handleFormCancel}
          />
        ) : isEditFormOpen && selectedObstacle ? (
          <ObstacleEditForm
            obstacle={selectedObstacle}
            onSubmit={handleObstacleUpdate}
            onCancel={handleEditCancel}
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

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>登録日時: {new Date(selectedObstacle.createdAt).toLocaleString("ja-JP")}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedObstacle(null)}>
                  選択解除
                </Button>
                {selectedObstacle.id && (
                  <>
                    <Button variant="default" size="icon" onClick={handleEditClick}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handleDeleteObstacle}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">登録済み障害物</h2>
            {obstacles.length > 0 ? (
              <ul className="space-y-2">
                {obstacles.map((obstacle, index) => (
                  <li
                    key={obstacle.id || index}
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
