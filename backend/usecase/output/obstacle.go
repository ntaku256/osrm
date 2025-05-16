package output

// Models for API layer
type Obstacle struct {
	ID          int        `json:"id"`
	Position    [2]float64 `json:"position"`
	Type        int        `json:"type"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel"`
	ImageS3Key  string     `json:"image_s3_key"`
	CreatedAt   string     `json:"createdAt"`
}

type ListObstacleResponse struct {
	Items []Obstacle `json:"items"`
}
