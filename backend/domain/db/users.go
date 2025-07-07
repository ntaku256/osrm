package db

type User struct {
	FirebaseUID     string `json:"firebase_uid" dynamodbav:"firebase_uid"`
	Username        string `json:"username" dynamodbav:"username"`
	Age             int    `json:"age" dynamodbav:"age"`
	Gender          string `json:"gender" dynamodbav:"gender"` // "male", "female", "other"
	HasDisability   bool   `json:"has_disability" dynamodbav:"has_disability"`
	EvacuationLevel int    `json:"evacuation_level" dynamodbav:"evacuation_level"` // 1-5: 避難能力レベル
	IsFirebaseDeleted bool `json:"is_firebase_deleted" dynamodbav:"is_firebase_deleted"` // Firebase認証が削除されているかどうか
	CreatedAt       string `json:"created_at" dynamodbav:"created_at"`
	UpdatedAt       string `json:"updated_at" dynamodbav:"updated_at"`
} 