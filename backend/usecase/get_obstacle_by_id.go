package usecase

import (
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/usecase/input"
	"webhook/usecase/obstacle"
)

// GetObstacleByID retrieves a single obstacle by ID
func GetObstacleByID(ctx interface{}, in input.ObstacleGetByID) (*obstacle.Obstacle, int, error) {
	id, err := strconv.Atoi(in.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo := db.NewObstacleRepo()
	obstacleDb, statusCode, err := obstacleRepo.Get(id)
	if err != nil {
		return nil, statusCode, err
	}

	// Check if the obstacle was found
	if obstacleDb == nil {
		return nil, http.StatusNotFound, nil
	}

	// Convert DB model to API model
	apiObstacle := obstacle.Obstacle{
		ID:          obstacleDb.ID,
		Position:    obstacleDb.Position,
		Type:        obstacleDb.Type,
		Description: obstacleDb.Description,
		DangerLevel: obstacleDb.DangerLevel,
		CreatedAt:   obstacleDb.CreatedAt,
	}

	return &apiObstacle, http.StatusOK, nil
} 