package usecase

import (
	"context"
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// GetShelterByID retrieves a single shelter by ID
func GetShelterByID(ctx context.Context, input input.ShelterGetByID) (*output.Shelter, int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	shelter, statusCode, err := shelterRepo.Get(ctx, id)
	if err != nil {
		return nil, statusCode, err
	}

	// Check if the shelter was found
	if shelter == nil {
		return nil, http.StatusNotFound, nil
	}

	apiShelter := adaptor.FromDBShelter(shelter)
	return &apiShelter, http.StatusOK, nil
} 