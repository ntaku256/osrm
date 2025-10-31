package db

type Shelter struct {
	ID                  int     `json:"id" dynamodbav:"id"`
	Name                string  `json:"name" dynamodbav:"name"`
	Lat                 float64 `json:"lat" dynamodbav:"lat"`
	Lon                 float64 `json:"lon" dynamodbav:"lon"`
	Address             string  `json:"address" dynamodbav:"address"`
	Elevation           float64 `json:"elevation" dynamodbav:"elevation"`                 // 標高（メートル）
	TsunamiSafetyLevel  int     `json:"tsunami_safety_level" dynamodbav:"tsunami_safety_level"` // 津波時の安全レベル
	CreatedAt           string  `json:"created_at" dynamodbav:"created_at"`
	UserID              string  `json:"user_id" dynamodbav:"user_id"`
} 
