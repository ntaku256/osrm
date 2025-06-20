"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type Obstacle, ObstacleType, DangerLevel } from "@/types/obstacle"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { obstacleApi } from "@/utils/api"
import ObstacleImageUploader from "@/components/ObstacleImageUploader"
import { getNearestRoad } from "@/utils/osrm"

interface ObstacleEditFormProps {
  obstacle: Obstacle & { id?: number }
  onSubmit: (updatedObstacle: Obstacle & { id?: number }) => void
  onCancel: () => void
  onNearestRoadUpdate?: (nearestRoad: any | null) => void
}

export default function ObstacleEditForm({ obstacle, onSubmit, onCancel, onNearestRoadUpdate }: ObstacleEditFormProps) {
  const [type, setType] = useState<ObstacleType>(obstacle.type)
  const [description, setDescription] = useState(obstacle.description)
  const [dangerLevel, setDangerLevel] = useState<DangerLevel>(obstacle.dangerLevel)
  const [nodes, setNodes] = useState<[number, number]>(obstacle.nodes)
  const [nearestDistance, setNearestDistance] = useState<number>(obstacle.nearestDistance)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUpdatingRoad, setIsUpdatingRoad] = useState(false)
  const { toast } = useToast()

  // フォームの初期値を設定
  useEffect(() => {
    setType(obstacle.type)
    setDescription(obstacle.description)
    setDangerLevel(obstacle.dangerLevel)
    setNodes(obstacle.nodes)
    setNearestDistance(obstacle.nearestDistance)
  }, [obstacle])

  const handleUpdateNearestRoad = async () => {
    setIsUpdatingRoad(true)
    try {
      const updatedRoad = await getNearestRoad(obstacle.position)
      if (updatedRoad && updatedRoad.nodes && updatedRoad.nodes.length >= 2) {
        const sorted = [...updatedRoad.nodes].sort((a, b) => a - b)
        setNodes([sorted[0], sorted[1]])
        setNearestDistance(updatedRoad.distance || 0)
        onNearestRoadUpdate?.(updatedRoad)
        toast({
          title: "更新完了",
          description: "最寄り道路情報を更新しました",
          variant: "default"
        })
      } else {
        toast({
          title: "エラー",
          description: "最寄り道路が見つかりませんでした",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Failed to update nearest road:", error)
      toast({
        title: "エラー",
        description: "最寄り道路情報の更新に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsUpdatingRoad(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!obstacle.id) {
      setError("更新するには障害物IDが必要です")
      setIsSubmitting(false)
      return
    }

    try {
      // 更新リクエストを作成
      const updateData = {
        position: obstacle.position,
        type,
        description,
        dangerLevel,
        nodes,
        nearestDistance,
      }

      // APIで障害物を更新
      const response = await obstacleApi.update(obstacle.id, updateData)

      if (response.error) {
        setError(response.error)
        toast({
          title: "エラー",
          description: response.error,
          variant: "destructive"
        })
      } else if (response.data) {
        // 成功したら通知
        toast({
          title: "更新完了",
          description: "障害物が正常に更新されました",
          variant: "default"
        })

        // 更新された障害物を親コンポーネントに渡す
        const updatedObstacle = {
          ...obstacle,
          type,
          description,
          dangerLevel,
          nodes,
          nearestDistance,
        }
        onSubmit(updatedObstacle)
      }
    } catch (error) {
      // 予期しないエラーを処理
      const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました'
      setError(errorMessage)
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>障害物を編集</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">緯度:</span> {obstacle.position[0].toFixed(6)}
            </div>
            <div>
              <span className="font-medium">経度:</span> {obstacle.position[1].toFixed(6)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium">最寄り道路情報</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUpdateNearestRoad}
                disabled={isUpdatingRoad}
                className="text-xs h-6 px-2"
              >
                {isUpdatingRoad ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    更新中
                  </>
                ) : (
                  "更新"
                )}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">最寄りノード:</span>
                {nodes[0] === 0 && nodes[1] === 0 ?
                  " 道路がない" :
                  ` [${nodes[0]}, ${nodes[1]}]`
                }
              </div>
              <div>
                <span className="font-medium">最寄り距離:</span>
                {nearestDistance === 0 ?
                  " 道路がない" :
                  ` ${nearestDistance.toFixed(1)} m`
                }
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">障害物の種類</Label>
            <Select value={type.toString()} onValueChange={(value) => setType(Number.parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="種類を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ObstacleType.BLOCK_WALL.toString()}>ブロック塀</SelectItem>
                <SelectItem value={ObstacleType.VENDING_MACHINE.toString()}>自動販売機</SelectItem>
                <SelectItem value={ObstacleType.STAIRS.toString()}>階段</SelectItem>
                <SelectItem value={ObstacleType.STEEP_SLOPES.toString()}>急な坂</SelectItem>
                <SelectItem value={ObstacleType.NARROW_ROADS.toString()}>狭い道</SelectItem>
                <SelectItem value={ObstacleType.OTHER.toString()}>その他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              placeholder="障害物の詳細を入力してください"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>危険度</Label>
            <RadioGroup
              value={dangerLevel.toString()}
              onValueChange={(value) => setDangerLevel(Number.parseInt(value))}
              className="flex space-x-2"
            >
              <div className="flex items-center space-x-1">
                <RadioGroupItem value={DangerLevel.LOW.toString()} id="low" />
                <Label htmlFor="low" className="text-green-600">
                  低
                </Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value={DangerLevel.MEDIUM.toString()} id="medium" />
                <Label htmlFor="medium" className="text-yellow-600">
                  中
                </Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value={DangerLevel.HIGH.toString()} id="high" />
                <Label htmlFor="high" className="text-red-600">
                  高
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
        {/* 画像アップロードUIを追加 */}
        <div className="px-6 pb-4 space-y-2">
          <Label className="font-medium">画像</Label>
          {obstacle.id && (
            <ObstacleImageUploader
              obstacleId={obstacle.id}
              onUploaded={(_imageS3Key, updatedObstacle) => {
                if (!updatedObstacle) return;
                // image_s3_keyとcreatedAtを更新し、onSubmitで親に伝える
                onSubmit({
                  ...obstacle,
                  image_s3_key: updatedObstacle.image_s3_key,
                  createdAt: updatedObstacle.createdAt,
                });
              }}
            />
          )}
        </div>
        <CardFooter className="flex justify-between">
          <Button variant="outline" type="button" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                更新中
              </>
            ) : (
              "更新"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
} 