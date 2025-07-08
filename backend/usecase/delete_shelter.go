package usecase

import (
	"context"
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/usecase/input"
)

// DeleteShelter deletes a shelter by ID
func DeleteShelter(ctx context.Context, input input.ShelterDelete, userID string, userRole string) (int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return http.StatusBadRequest, err
	}

	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	existingShelter, _, err := shelterRepo.Get(ctx, id)
	if existingShelter == nil {
		return http.StatusNotFound, nil
	}
	// 認可判定
	if !(userRole == "admin" || (userRole == "editor" && existingShelter.UserID == userID)) {
		return http.StatusForbidden, nil
	}

	statusCode, err := shelterRepo.Delete(ctx, id)
	if err != nil {
		return statusCode, err
	}

	return http.StatusNoContent, nil
} 