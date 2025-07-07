package output

type User struct {
	FirebaseUID       string `json:"firebase_uid"`
	Username          string `json:"username"`
	Age               int    `json:"age"`
	Gender            string `json:"gender"`
	HasDisability     bool   `json:"has_disability"`
	EvacuationLevel   int    `json:"evacuation_level"`
	IsFirebaseDeleted bool   `json:"is_firebase_deleted"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
} 