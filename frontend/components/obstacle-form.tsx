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
import { getNearestRoad } from "@/utils/osrm"

interface ObstacleFormProps {
  position: [number, number]
  nearestRoad: any | null
  onSubmit: (obstacle: Obstacle) => void
  onCancel: () => void
  onNearestRoadUpdate?: (nearestRoad: any | null) => void
}

export default function ObstacleForm({ position, nearestRoad, onSubmit, onCancel, onNearestRoadUpdate }: ObstacleFormProps) {
  const [type, setType] = useState<ObstacleType>(ObstacleType.OTHER)
  const [description, setDescription] = useState("")
  const [dangerLevel, setDangerLevel] = useState<DangerLevel>(DangerLevel.MEDIUM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentNearestRoad, setCurrentNearestRoad] = useState(nearestRoad)
  const [isUpdatingRoad, setIsUpdatingRoad] = useState(false)
  const { toast } = useToast()

  // 初期化時にnearestRoadを設定
  useEffect(() => {
    setCurrentNearestRoad(nearestRoad)
    onNearestRoadUpdate?.(nearestRoad)
  }, [nearestRoad, onNearestRoadUpdate])

  const handleUpdateNearestRoad = async () => {
    setIsUpdatingRoad(true)
    try {
      const updatedRoad = await getNearestRoad(position)
      setCurrentNearestRoad(updatedRoad)
      onNearestRoadUpdate?.(updatedRoad)
      toast({
        title: "更新完了",
        description: "最寄り道路情報を更新しました",
        variant: "default"
      })
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

    try {
      let nodes: [number, number] | undefined = undefined
      if (currentNearestRoad?.nodes && currentNearestRoad.nodes.length >= 2) {
        const sorted = [...currentNearestRoad.nodes].sort((a, b) => a - b)
        nodes = [sorted[0], sorted[1]]
      }
      const obstacleData = {
        position,
        type,
        description,
        dangerLevel,
        nodes,
        nearestDistance: currentNearestRoad?.distance !== undefined ? currentNearestRoad.distance : undefined,
      }

      // Send the data to the API
      const response = await obstacleApi.create(obstacleData)

      if (response.error) {
        setError(response.error)
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive"
        })
      } else if (response.data) {
        // Handle successful creation
        toast({
          title: "Success",
          description: "Obstacle registered successfully!",
          variant: "default"
        })

        // Call the onSubmit handler with the created obstacle
        onSubmit(response.data)
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setError(errorMessage)
      toast({
        title: "Error",
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
        <CardTitle>障害物を登録</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {currentNearestRoad && (
            <div className="p-2 bg-blue-50 rounded text-sm text-blue-900 border border-blue-200 mb-2">
              <div className="flex justify-between items-center mb-1">
                <span>最寄り道路情報</span>
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
              <div>最寄り道路: <span className="font-semibold">{currentNearestRoad.name}</span></div>
              <div>距離: {currentNearestRoad.distance ? currentNearestRoad.distance.toFixed(1) : "-"} m</div>
            </div>
          )}
          {!currentNearestRoad && (
            <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 border border-gray-200 mb-2">
              <div className="flex justify-between items-center mb-1">
                <span>最寄り道路が見つかりませんでした</span>
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
                    "再検索"
                  )}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">緯度:</span> {position[0].toFixed(6)}
            </div>
            <div>
              <span className="font-medium">経度:</span> {position[1].toFixed(6)}
            </div>
          </div>

          {currentNearestRoad && currentNearestRoad.nodes && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">最寄りノード:</span>
                {currentNearestRoad.nodes[0] === 0 && currentNearestRoad.nodes[1] === 0 ?
                  " 道路がない" :
                  ` [${currentNearestRoad.nodes[0]}, ${currentNearestRoad.nodes[1]}]`
                }
              </div>
              <div>
                <span className="font-medium">最寄り距離:</span>
                {currentNearestRoad.distance === 0 ?
                  " 道路がない" :
                  ` ${currentNearestRoad.distance ? currentNearestRoad.distance.toFixed(1) : "-"} m`
                }
              </div>
            </div>
          )}

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
        <CardFooter className="flex justify-between">
          <Button variant="outline" type="button" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                送信中
              </>
            ) : (
              "登録"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
