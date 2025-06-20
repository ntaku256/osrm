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
import type { MapMode } from "@/app/content"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Update Obstacle type to include id for API interaction
interface ExtendedObstacle extends Obstacle {
  id?: number;
}

// Dynamically import the map component to avoid SSR issues with Leaflet
const ObstacleMap = dynamic(() => import("@/components/obstacle-map"), {
  ssr: false,
  loading: () => <div className="h-[600px] bg-gray-100 flex items-center justify-center">地図を読み込み中...</div>,
})

interface ObstacleMapContainerProps {
  mode: MapMode;
}

export default function ObstacleMapContainer({ mode }: ObstacleMapContainerProps) {
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // modeがcreate以外になったら選択位置をリセット
  useEffect(() => {
    if (mode !== "create") {
      setSelectedPosition(null);
      setHighlightedNode(null);
    }
  }, [mode]);

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
            duration: 3000,
          });
        }
      } catch (error) {
        console.error("Failed to fetch obstacles:", error);
        toast({
          title: "エラー",
          description: "障害物の取得中にエラーが発生しました",
          variant: "destructive",
          duration: 3000,
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
    setHighlightedNode(null)
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
        duration: 3000,
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
          duration: 3000,
        });
      } else {
        toast({
          title: "エラー",
          description: "障害物の削除に失敗しました: " + response.error,
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to delete obstacle:", error);
      toast({
        title: "エラー",
        description: "障害物の削除中にエラーが発生しました",
        variant: "destructive",
        duration: 3000,
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
            mode={mode}
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
        {selectedObstacle && !(mode === "edit" && isEditFormOpen) && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>障害物詳細</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 画像表示 */}
              {selectedObstacle.image_s3_key && (
                <img
                  src={`https://${process.env.NEXT_PUBLIC_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_S3_REGION}.amazonaws.com/${selectedObstacle.image_s3_key}?t=${selectedObstacle.createdAt ? new Date(selectedObstacle.createdAt).getTime() : ''}`}
                  alt="障害物画像"
                  className="mb-2 max-w-full max-h-96 object-contain border rounded"
                />
              )}
              <div className="mb-2">
                <span className="font-medium">種類:</span> {getObstacleTypeIcon(selectedObstacle.type)}
              </div>
              <div className="mb-2">
                <span className="font-medium">説明:</span> {selectedObstacle.description}
              </div>
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">危険度:</span>
                  <div className={`w-4 h-4 rounded-full ${getDangerLevelBg(selectedObstacle.dangerLevel)}`}></div>
                  {DangerLevel[selectedObstacle.dangerLevel]}
                </div>
              </div>
              <div className="mb-2">
                <span className="font-medium">緯度:</span> {selectedObstacle.position[0].toFixed(6)}
              </div>
              <div className="mb-2">
                <span className="font-medium">経度:</span> {selectedObstacle.position[1].toFixed(6)}
              </div>
              <div className="mb-2">
                <span className="font-medium">最寄りノード:</span> [{selectedObstacle.nodes[0]}, {selectedObstacle.nodes[1]}]
              </div>
              <div className="mb-2">
                <span className="font-medium">最寄り距離:</span> {selectedObstacle.nearestDistance.toFixed(1)} m
              </div>
              <div className="mb-2">
                <span className="font-medium">更新日時:</span> {new Date(selectedObstacle.createdAt).toLocaleString("ja-JP")}
              </div>
              <div className="flex flex-col gap-2">
                {mode === "edit" && selectedObstacle.id && (
                  <div className="flex justify-between gap-2">
                    <Button
                      variant="default"
                      className="flex-1 min-w-[100px] px-6"
                      onClick={handleEditClick}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      編集
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setSelectedObstacle(null)}
                >
                  選択解除
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {mode === "create" && isFormOpen && selectedPosition ? (
          <ObstacleForm
            position={selectedPosition}
            nearestRoad={nearestRoad}
            onSubmit={handleObstacleSubmit}
            onCancel={handleFormCancel}
          />
        ) : mode === "edit" && isEditFormOpen && selectedObstacle ? (
          <ObstacleEditForm
            obstacle={selectedObstacle}
            onSubmit={handleObstacleUpdate}
            onCancel={handleEditCancel}
          />
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
                      <div className="font-medium">{getObstacleTypeIcon(obstacle.type)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${getDangerLevelBg(obstacle.dangerLevel)}`}></div>
                      <div className="text-sm text-gray-500">危険度: {DangerLevel[obstacle.dangerLevel]}</div>
                    </div>
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
      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>本当に削除しますか？</DialogTitle>
            <DialogDescription>
              この操作は取り消せません。障害物を削除してもよろしいですか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setShowDeleteDialog(false);
                await handleDeleteObstacle();
              }}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      return "🧱ブロック塀"
    case ObstacleType.VENDING_MACHINE:
      return "🥤自動販売機"
    case ObstacleType.STAIRS:
      return "🪜階段"
    case ObstacleType.STEEP_SLOPES:
      return "⛰️急な坂"
    case ObstacleType.NARROW_ROADS:
      return "↔️狭い道"
    case ObstacleType.OTHER:
      return "❓その他"
    default:
      return "•"
  }
}
