package usecase

import (
	"context"
	"net/http"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// GetShelters retrieves all shelters
func GetShelters(ctx context.Context, input input.ShelterGetAll) (*output.ListShelterResponse, int, error) {
	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	shelters, statusCode, err := shelterRepo.List(ctx)
	if err != nil {
		return nil, statusCode, err
	}

	// Convert DB shelters to API shelters
	var apiShelters []output.Shelter
	for _, shelter := range *shelters {
		apiShelters = append(apiShelters, adaptor.FromDBShelter(&shelter))
	}

	response := &output.ListShelterResponse{
		Items: apiShelters,
	}

	return response, http.StatusOK, nil
} 