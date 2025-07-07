package usecase

import (
	"context"
	"net/http"
	"time"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// CreateShelter creates a new shelter
func CreateShelter(ctx context.Context, input input.ShelterCreate) (*output.Shelter, int, error) {
	// Generate a new ID
	// In a real application, you might use an auto-increment strategy or UUID
	id := int(time.Now().UnixNano() % 1000000)

	// Create a new shelter
	shelter := db.Shelter{
		ID:                  id,
		Name:                input.Name,
		Lat:                 input.Lat,
		Lon:                 input.Lon,
		Address:             input.Address,
		Elevation:           input.Elevation,
		TsunamiSafetyLevel:  input.TsunamiSafetyLevel,
		CreatedAt:           time.Now().Format(time.RFC3339),
	}

	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	statusCode, err := shelterRepo.CreateOrUpdate(ctx, &shelter)
	if err != nil {
		return nil, statusCode, err
	}

	apiShelter := adaptor.FromDBShelter(&shelter)
	return &apiShelter, http.StatusCreated, nil
} 