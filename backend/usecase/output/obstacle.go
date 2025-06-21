package output

// Models for API layer
type Obstacle struct {
	ID          int        `json:"id"`
	Position    [2]float64 `json:"position"`
	Type        int        `json:"type"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel"`
	Nodes       []int64    `json:"nodes"`
	NearestDistance float64 `json:"nearestDistance"`
	NoNearbyRoad  bool       `json:"noNearbyRoad"`
	ImageS3Key  string     `json:"image_s3_key"`
	CreatedAt   string     `json:"createdAt"`
}

type ListObstacleResponse struct {
	Items []Obstacle `json:"items"`
}
