package input

type UserCreate struct {
	FirebaseUID     string `json:"firebase_uid"`
	Username        string `json:"username"`
	Age             int    `json:"age"`
	Gender          string `json:"gender"`
	HasDisability   bool   `json:"has_disability"`
	EvacuationLevel int    `json:"evacuation_level"` // 1-5
}

type UserUpdate struct {
	FirebaseUID     string `json:"firebase_uid"`
	Username        string `json:"username"`
	Age             int    `json:"age"`
	Gender          string `json:"gender"`
	HasDisability   bool   `json:"has_disability"`
	EvacuationLevel int    `json:"evacuation_level"` // 1-5
}

type UserGetByFirebaseUID struct {
	FirebaseUID string `json:"firebase_uid"`
}

type UserDelete struct {
	FirebaseUID string `json:"firebase_uid"`
} 