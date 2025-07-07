package output

// Models for API layer
type Shelter struct {
	ID                  int     `json:"id"`
	Name                string  `json:"name"`
	Lat                 float64 `json:"lat"`
	Lon                 float64 `json:"lon"`
	Address             string  `json:"address"`
	Elevation           float64 `json:"elevation"`
	TsunamiSafetyLevel  int     `json:"tsunami_safety_level"`
	CreatedAt           string  `json:"created_at"`
}

type ListShelterResponse struct {
	Items []Shelter `json:"items"`
} 