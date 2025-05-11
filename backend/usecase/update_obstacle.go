package usecase

import (
	"net/http"
	"strconv"
	"time"

	"webhook/domain/db"
	"webhook/usecase/input"
	"webhook/usecase/obstacle"
)

// UpdateObstacle updates an existing obstacle
func UpdateObstacle(ctx interface{}, in input.ObstacleUpdate) (*obstacle.Obstacle, int, error) {
	id, err := strconv.Atoi(in.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo := db.NewObstacleRepo()
	
	// Check if the obstacle exists
	_, statusCode, err := obstacleRepo.Get(id)
	if err != nil {
		return nil, statusCode, err
	}

	// Update the obstacle
	obstacleDb := db.Obstacle{
		ID:          id,
		Position:    in.Position,
		Type:        in.Type,
		Description: in.Description,
		DangerLevel: in.DangerLevel,
		CreatedAt:   time.Now().Format(time.RFC3339), // Update the timestamp
	}

	statusCode, err = obstacleRepo.CreateOrUpdate(&obstacleDb)
	if err != nil {
		return nil, statusCode, err
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