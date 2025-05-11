package usecase

import (
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/usecase/input"
)

// DeleteObstacle deletes an obstacle by ID
func DeleteObstacle(ctx interface{}, in input.ObstacleDelete) (int, error) {
	id, err := strconv.Atoi(in.ID)
	if err != nil {
		return http.StatusBadRequest, err
	}

	obstacleRepo := db.NewObstacleRepo()
	statusCode, err := obstacleRepo.Delete(id)
	if err != nil {
		return statusCode, err
	}

	return http.StatusNoContent, nil
} 