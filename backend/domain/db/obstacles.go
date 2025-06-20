package db

type Obstacle struct {
	ID          int        `json:"id" dynamodbav:"id"`
	Position    [2]float64 `json:"position" dynamodbav:"position"`
	Type        int        `json:"type" dynamodbav:"type"`
	Description string     `json:"description" dynamodbav:"description"`
	DangerLevel int        `json:"danger_level" dynamodbav:"danger_level"`
	Nodes       [2]float64 `json:"nodes" dynamodbav:"nodes"`
	NearestDistance float64 `json:"nearest_distance" dynamodbav:"nearest_distance"`
	NoNearbyRoad  bool       `json:"no_nearby_road" dynamodbav:"no_nearby_road"`
	ImageS3Key  string     `json:"image_s3_key" dynamodbav:"image_s3_key"`
	CreatedAt   string     `json:"created_at" dynamodbav:"created_at"`
}
