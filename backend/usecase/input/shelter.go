package input

// ShelterGetAll represents input parameters for getting all shelters
type ShelterGetAll struct{}

// ShelterGetByID represents input parameters for getting a shelter by ID
type ShelterGetByID struct {
	ID string `json:"id" validate:"required"`
}

// ShelterCreate represents input parameters for creating a shelter
type ShelterCreate struct {
	Name                string  `json:"name" validate:"required"`
	Lat                 float64 `json:"lat" validate:"required"`
	Lon                 float64 `json:"lon" validate:"required"`
	Address             string  `json:"address" validate:"required"`
	Elevation           float64 `json:"elevation" validate:"required"`
	TsunamiSafetyLevel  int     `json:"tsunami_safety_level" validate:"required"`
}

// ShelterUpdate represents input parameters for updating a shelter
type ShelterUpdate struct {
	ID                  string  `json:"id" validate:"required"`
	Name                string  `json:"name" validate:"required"`
	Lat                 float64 `json:"lat" validate:"required"`
	Lon                 float64 `json:"lon" validate:"required"`
	Address             string  `json:"address" validate:"required"`
	Elevation           float64 `json:"elevation" validate:"required"`
	TsunamiSafetyLevel  int     `json:"tsunami_safety_level" validate:"required"`
}

// ShelterDelete represents input parameters for deleting a shelter
type ShelterDelete struct {
	ID string `json:"id" validate:"required"`
} 