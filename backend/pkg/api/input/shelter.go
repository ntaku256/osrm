package apiinput

type CreateShelterRequest struct {
	Name                string  `json:"name" validate:"required"`
	Lat                 float64 `json:"lat" validate:"required"`
	Lon                 float64 `json:"lon" validate:"required"`
	Address             string  `json:"address" validate:"required"`
	Elevation           float64 `json:"elevation" validate:"required"`
	TsunamiSafetyLevel  int     `json:"tsunami_safety_level" validate:"required"`
}

type UpdateShelterRequest struct {
	Name                string  `json:"name" validate:"required"`
	Lat                 float64 `json:"lat" validate:"required"`
	Lon                 float64 `json:"lon" validate:"required"`
	Address             string  `json:"address" validate:"required"`
	Elevation           float64 `json:"elevation" validate:"required"`
	TsunamiSafetyLevel  int     `json:"tsunami_safety_level" validate:"required"`
} 