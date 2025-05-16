export enum ObstacleType {
  BLOCK_WALL = 0,
  VENDING_MACHINE = 1,
  STAIRS = 2,
  STEEP_SLOPES = 3,
  NARROW_ROADS = 4,
  OTHER = 5,
}

export enum DangerLevel {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export interface Obstacle {
  position: [number, number] // [latitude, longitude]
  type: ObstacleType
  description: string
  dangerLevel: DangerLevel
  nodes: [number, number]
  nearestDistance: number
  createdAt: string // ISO date string
  image_s3_key?: string
}
