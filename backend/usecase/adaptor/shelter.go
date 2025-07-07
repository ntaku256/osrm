package adaptor

import (
	"webhook/domain/db"
	"webhook/usecase/output"
)

// Convert from API model to DB model
func ToDBShelter(shelter output.Shelter) *db.Shelter {
	return &db.Shelter{
		ID:                  shelter.ID,
		Name:                shelter.Name,
		Lat:                 shelter.Lat,
		Lon:                 shelter.Lon,
		Address:             shelter.Address,
		Elevation:           shelter.Elevation,
		TsunamiSafetyLevel:  shelter.TsunamiSafetyLevel,
		CreatedAt:           shelter.CreatedAt,
	}
}

// Convert from DB model to API model
func FromDBShelter(dbShelter *db.Shelter) output.Shelter {
	return output.Shelter{
		ID:                  dbShelter.ID,
		Name:                dbShelter.Name,
		Lat:                 dbShelter.Lat,
		Lon:                 dbShelter.Lon,
		Address:             dbShelter.Address,
		Elevation:           dbShelter.Elevation,
		TsunamiSafetyLevel:  dbShelter.TsunamiSafetyLevel,
		CreatedAt:           dbShelter.CreatedAt,
	}
} 