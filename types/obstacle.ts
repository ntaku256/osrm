export enum ObstacleType {
  CONSTRUCTION = 0,
  ROAD_DAMAGE = 1,
  FLOODING = 2,
  FALLEN_OBJECT = 3,
  NARROW_PATH = 4,
  OTHER = 5,
}

export enum DangerLevel {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export interface RouteInfo {
  routeId: string
  distance: number // 最寄りの道路までの距離（メートル）
  name?: string // 道路名（利用可能な場合）
}

export interface Obstacle {
  position: [number, number] // [latitude, longitude]
  type: ObstacleType
  description: string
  routeLink: string // ID or reference to a route
  routeInfo?: RouteInfo // 最寄りの経路情報
  dangerLevel: DangerLevel
  createdAt: string // ISO date string
}
