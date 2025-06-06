package apiinput

type CreateObstacleRequest struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
	Nodes       [2]float64 `json:"nodes" validate:"required"`
	NearestDistance float64 `json:"nearestDistance" validate:"required"`
}

type UpdateObstacleRequest struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
	Nodes       [2]float64 `json:"nodes" validate:"required"`
	NearestDistance float64 `json:"nearestDistance" validate:"required"`
}
