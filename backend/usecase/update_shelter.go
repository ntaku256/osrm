package usecase

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// UpdateShelter updates an existing shelter
func UpdateShelter(ctx context.Context, input input.ShelterUpdate) (*output.Shelter, int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	// Check if the shelter exists
	existingShelter, statusCode, err := shelterRepo.Get(ctx, id)
	if err != nil {
		return nil, statusCode, err
	}
	if existingShelter == nil {
		return nil, http.StatusNotFound, nil
	}

	// Update the shelter
	shelter := db.Shelter{
		ID:                  id,
		Name:                input.Name,
		Lat:                 input.Lat,
		Lon:                 input.Lon,
		Address:             input.Address,
		Elevation:           input.Elevation,
		TsunamiSafetyLevel:  input.TsunamiSafetyLevel,
		CreatedAt:           time.Now().Format(time.RFC3339), // Update the timestamp
	}

	statusCode, err = shelterRepo.CreateOrUpdate(ctx, &shelter)
	if err != nil {
		return nil, statusCode, err
	}

	apiShelter := adaptor.FromDBShelter(&shelter)
	return &apiShelter, http.StatusOK, nil
} 