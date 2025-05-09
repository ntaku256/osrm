"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type Obstacle, ObstacleType, DangerLevel, type RouteInfo } from "@/types/obstacle"
import { getNearestRoad } from "@/utils/osrm"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ObstacleFormProps {
  position: [number, number]
  onSubmit: (obstacle: Obstacle) => void
  onCancel: () => void
  availableRoutes?: Array<{
    id: string
    geometry: string
    direction: string
    distance: number
  }>
}

export default function ObstacleForm({ position, onSubmit, onCancel, availableRoutes = [] }: ObstacleFormProps) {
  const [type, setType] = useState<ObstacleType>(ObstacleType.OTHER)
  const [description, setDescription] = useState("")
  const [routeLink, setRouteLink] = useState("")
  const [dangerLevel, setDangerLevel] = useState<DangerLevel>(DangerLevel.MEDIUM)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string>("")

  // 位置情報が変更されたときに最寄りの道路情報を取得
  useEffect(() => {
    async function fetchNearestRoad() {
      setIsLoadingRoute(true)
      setRouteError(null)

      try {
        const nearestRoad = await getNearestRoad(position)

        if (nearestRoad) {
          const newRouteInfo: RouteInfo = {
            routeId: nearestRoad.nodes?.join("-") || "unknown",
            distance: nearestRoad.distance,
            name: nearestRoad.name || "名称なし",
          }

          setRouteInfo(newRouteInfo)
          // 経路IDを自動設定
          setRouteLink(newRouteInfo.routeId)
        } else {
          setRouteError("最寄りの道路が見つかりませんでした")
        }
      } catch (error) {
        console.error("Error fetching nearest road:", error)
        setRouteError("経路情報の取得に失敗しました。ネットワーク接続を確認してください。")
      } finally {
        setIsLoadingRoute(false)
      }
    }

    fetchNearestRoad()
  }, [position])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 選択された経路のジオメトリを取得
    let routeGeometry = ""
    if (selectedRouteId && availableRoutes.length > 0) {
      const selectedRoute = availableRoutes.find((route) => route.id === selectedRouteId)
      if (selectedRoute) {
        routeGeometry = selectedRoute.geometry
      }
    }

    const obstacle: Obstacle = {
      position,
      type,
      description,
      routeLink: routeGeometry || routeLink, // 選択された経路があればそれを使用、なければrouteLinkを使用
      routeInfo: routeInfo || undefined,
      dangerLevel,
      createdAt: new Date().toISOString(),
    }

    onSubmit(obstacle)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>障害物を登録</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">緯度:</span> {position[0].toFixed(6)}
            </div>
            <div>
              <span className="font-medium">経度:</span> {position[1].toFixed(6)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">障害物の種類</Label>
            <Select value={type.toString()} onValueChange={(value) => setType(Number.parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="種類を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ObstacleType.CONSTRUCTION.toString()}>工事</SelectItem>
                <SelectItem value={ObstacleType.ROAD_DAMAGE.toString()}>道路損傷</SelectItem>
                <SelectItem value={ObstacleType.FLOODING.toString()}>冠水</SelectItem>
                <SelectItem value={ObstacleType.FALLEN_OBJECT.toString()}>落下物</SelectItem>
                <SelectItem value={ObstacleType.NARROW_PATH.toString()}>狭路</SelectItem>
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
            <Label htmlFor="routeInfo">最寄り道路情報</Label>
            <div className="p-2 bg-gray-50 rounded border text-sm">
              {isLoadingRoute ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>道路情報を取得中...</span>
                </div>
              ) : routeError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{routeError}</AlertDescription>
                </Alert>
              ) : routeInfo ? (
                <div>
                  <p>
                    <span className="font-medium">道路名:</span> {routeInfo.name}
                  </p>
                  <p>
                    <span className="font-medium">距離:</span> {routeInfo.distance.toFixed(1)}m
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">道路情報がありません</p>
              )}
            </div>
          </div>

          {availableRoutes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="selectedRoute">関連経路を選択</Label>
              <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                <SelectTrigger>
                  <SelectValue placeholder="経路を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">経路なし</SelectItem>
                  {availableRoutes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.direction} ({(route.distance / 1000).toFixed(1)}km)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {selectedRouteId
                  ? "選択した経路が障害物に関連付けられます"
                  : "経路を選択しない場合、障害物は経路に関連付けられません"}
              </p>
            </div>
          )}

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
          <Button type="submit" disabled={isLoadingRoute}>
            {isLoadingRoute ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                読み込み中
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
