package apiinput

type CreateObstacleRequest struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
	Nodes       []int64    `json:"nodes" validate:"required"`
	NearestDistance float64 `json:"nearestDistance" validate:"required"`
	NoNearbyRoad  bool       `json:"noNearbyRoad"`
}

type UpdateObstacleRequest struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
	Nodes       []int64    `json:"nodes" validate:"required"`
	NearestDistance float64 `json:"nearestDistance" validate:"required"`
	NoNearbyRoad  bool       `json:"noNearbyRoad"`
}
