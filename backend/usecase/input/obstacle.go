package input

// ObstacleGetAll represents input parameters for getting all obstacles
type ObstacleGetAll struct{}

// ObstacleGetByID represents input parameters for getting an obstacle by ID
type ObstacleGetByID struct {
	ID string
}

// ObstacleCreate represents input parameters for creating an obstacle
type ObstacleCreate struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
}

// ObstacleUpdate represents input parameters for updating an obstacle
type ObstacleUpdate struct {
	ID          string     `json:"id" validate:"required"`
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
}

// ObstacleDelete represents input parameters for deleting an obstacle
type ObstacleDelete struct {
	ID string
} 