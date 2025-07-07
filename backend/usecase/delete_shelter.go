package usecase

import (
	"context"
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/usecase/input"
)

// DeleteShelter deletes a shelter by ID
func DeleteShelter(ctx context.Context, input input.ShelterDelete) (int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return http.StatusBadRequest, err
	}

	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	statusCode, err := shelterRepo.Delete(ctx, id)
	if err != nil {
		return statusCode, err
	}

	return http.StatusNoContent, nil
} 