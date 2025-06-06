package input

// ObstacleGetAll represents input parameters for getting all obstacles
type ObstacleGetAll struct{}

// ObstacleGetByID represents input parameters for getting an obstacle by ID
type ObstacleGetByID struct {
	ID string `json:"id" validate:"required"`
}

// ObstacleCreate represents input parameters for creating an obstacle
type ObstacleCreate struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
	Nodes       [2]float64 `json:"nodes" validate:"required"`
	NearestDistance float64 `json:"nearestDistance" validate:"required"`
}

// ObstacleUpdate represents input parameters for updating an obstacle
type ObstacleUpdate struct {
	ID          string     `json:"id" validate:"required"`
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
	Nodes       [2]float64 `json:"nodes" validate:"required"`
	NearestDistance float64 `json:"nearestDistance" validate:"required"`
}

// ObstacleDelete represents input parameters for deleting an obstacle
type ObstacleDelete struct {
	ID string `json:"id" validate:"required"`
}

// 画像S3キー更新用
// ObstacleUpdateImageS3Key represents input parameters for updating image_s3_key of an obstacle
type ObstacleUpdateImageS3Key struct {
	ID         string `json:"id" validate:"required"`
	ImageS3Key string `json:"image_s3_key" validate:"required"`
}
