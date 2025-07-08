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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingNearestRoad, setEditingNearestRoad] = useState<any | null>(null)
  const [obstacleFilter, setObstacleFilter] = useState<'all' | 'hideRoadless' | 'roadlessOnly'>('all')

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
    setEditingNearestRoad(null)
  }

  const handleEditClick = async () => {
    setIsEditFormOpen(true)
    if (selectedObstacle) {
      const nearest = await getNearestRoad(selectedObstacle.position)
      setEditingNearestRoad(nearest)
    }
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
            nearestRoadLocation={
              mode === "edit" && isEditFormOpen
                ? editingNearestRoad?.location
                : nearestRoad?.location
            }
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
                <span className="font-medium">最寄りノード:</span> [{selectedObstacle.nodes?.[0] || 0}, {selectedObstacle.nodes?.[1] || 0}]
              </div>
              <div className="mb-2">
                <span className="font-medium">最寄り距離:</span> {(selectedObstacle.nearestDistance || 0).toFixed(1)} m
              </div>
              <div className="mb-2">
                <span className="font-medium">道路なしフラグ:</span>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${selectedObstacle.noNearbyRoad
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
                  }`}>
                  {(selectedObstacle.noNearbyRoad) ? '✓ 道路なし確認済み' : ((selectedObstacle.nodes?.[0] || 0) === 0 && (selectedObstacle.nodes?.[1] || 0) === 0 && (selectedObstacle.nearestDistance || 0) === 0 ? '✗ 未確認' : '•')}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-medium">作成者UID:</span> {selectedObstacle.user_id}
              </div>
              <div className="mb-2">
                <span className="font-medium">更新日時:</span> {selectedObstacle.createdAt ? new Date(selectedObstacle.createdAt).toLocaleString("ja-JP") : '不明'}
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
            onNearestRoadUpdate={setNearestRoad}
          />
        ) : mode === "edit" && isEditFormOpen && selectedObstacle ? (
          <ObstacleEditForm
            obstacle={selectedObstacle}
            onSubmit={handleObstacleUpdate}
            onCancel={handleEditCancel}
            onNearestRoadUpdate={setEditingNearestRoad}
          />
        ) : (
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">登録済み障害物</h2>
              {mode === "edit" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextFilter = obstacleFilter === 'all'
                      ? 'hideRoadless'
                      : obstacleFilter === 'hideRoadless'
                        ? 'roadlessOnly'
                        : 'all'
                    setObstacleFilter(nextFilter)
                  }}
                  className="text-xs"
                >
                  {obstacleFilter === 'all'
                    ? "全て表示"
                    : obstacleFilter === 'hideRoadless'
                      ? "道路登録済みの障害物のみ表示"
                      : "道路なしのみ表示"
                  }
                </Button>
              )}
            </div>
            {(() => {
              // フィルタ適用
              const filteredObstacles = mode === "edit" ? (() => {
                const isRoadless = (obstacle: ExtendedObstacle) =>
                  (obstacle.nodes?.[0] || 0) === 0 && (obstacle.nodes?.[1] || 0) === 0 && (obstacle.nearestDistance || 0) === 0

                switch (obstacleFilter) {
                  case 'hideRoadless':
                    return obstacles.filter(obstacle => !isRoadless(obstacle))
                  case 'roadlessOnly':
                    // noNearbyRoadフラグが立っていない（未処理の）道路なし障害物のみを表示
                    return obstacles.filter(obstacle => isRoadless(obstacle) && !obstacle.noNearbyRoad)
                  default:
                    return obstacles
                }
              })() : obstacles

              return filteredObstacles.length > 0 ? (
                <div>
                  {mode === "edit" && obstacleFilter !== 'all' && filteredObstacles.length !== obstacles.length && (
                    <div className="mb-2 text-xs text-gray-500">
                      {obstacleFilter === 'hideRoadless'
                        ? `${obstacles.length - filteredObstacles.length}件の道路情報なし障害物を非表示中`
                        : `道路情報なし障害物のみ${filteredObstacles.length}件を表示中`
                      }
                    </div>
                  )}
                  <ul className="space-y-2">
                    {filteredObstacles.map((obstacle, index) => (
                      <li
                        key={obstacle.id || index}
                        className="border rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setSelectedObstacle(obstacle)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{getObstacleTypeIcon(obstacle.type)}</div>
                            {mode === "edit" && (
                              <div className="flex items-center gap-1">
                                                                 {(obstacle.nodes?.[0] || 0) === 0 && (obstacle.nodes?.[1] || 0) === 0 && (obstacle.nearestDistance || 0) === 0 && (
                                  <div className={`text-xs px-1 rounded ${obstacle.noNearbyRoad
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {obstacle.noNearbyRoad ? '道路なし確認済み' : '道路なし'}
                                  </div>
                                )}
                                <div className={`text-xs px-1 rounded border ${obstacle.noNearbyRoad
                                  ? 'bg-red-50 text-red-600 border-red-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                                  }`} title={obstacle.noNearbyRoad ? '道路なしフラグ: ON' : '道路なしフラグ: OFF'}>
                                  {obstacle.noNearbyRoad ? '✓' : ((obstacle.nodes?.[0] || 0) === 0 && (obstacle.nodes?.[1] || 0) === 0 && (obstacle.nearestDistance || 0) === 0 ? '✗' : '•')}
                                </div>
                              </div>
                            )}
                          </div>
                          {obstacle.id && (
                            <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono">
                              ID: {obstacle.id}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${getDangerLevelBg(obstacle.dangerLevel)}`}></div>
                          <div className="text-sm text-gray-500">危険度: {DangerLevel[obstacle.dangerLevel]}</div>
                        </div>
                        <div className="text-sm truncate">{obstacle.description}</div>
                        {/* <div>作成者UID: {obstacle.user_id}</div> */}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-500">
                  {obstacleFilter !== 'all' && mode === "edit" && obstacles.length > 0
                    ? "フィルタ条件に一致する障害物がありません"
                    : "地図上をクリックして障害物を登録してください"
                  }
                </p>
              )
            })()}
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
