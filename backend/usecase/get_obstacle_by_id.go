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

// GetObstacleByID retrieves a single obstacle by ID
func GetObstacleByID(ctx context.Context, input input.ObstacleGetByID) (*output.Obstacle, int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	obstacle, statusCode, err := obstacleRepo.Get(ctx, id)
	if err != nil {
		return nil, statusCode, err
	}

	// Check if the obstacle was found
	if obstacle == nil {
		return nil, http.StatusNotFound, nil
	}

	apiObstacle := adaptor.FromDBObstacle(obstacle)
	return &apiObstacle, http.StatusOK, nil
}
