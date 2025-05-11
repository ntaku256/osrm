package db

type Obstacle struct {
	ID          int        `json:"id" dynamodbav:"id"`
	Position    [2]float64 `json:"position" dynamodbav:"position"`
	Type        int        `json:"type" dynamodbav:"type"`
	Description string     `json:"description" dynamodbav:"description"`
	DangerLevel int        `json:"danger_level" dynamodbav:"danger_level"`
	CreatedAt   string     `json:"created_at" dynamodbav:"created_at"`
}

