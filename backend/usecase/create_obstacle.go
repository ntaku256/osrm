package usecase

import (
	"net/http"
	"time"

	"webhook/domain/db"
	"webhook/usecase/input"
	"webhook/usecase/obstacle"
)

// CreateObstacle creates a new obstacle
func CreateObstacle(ctx interface{}, in input.ObstacleCreate) (*obstacle.Obstacle, int, error) {
	// Generate a new ID
	// In a real application, you might use an auto-increment strategy or UUID
	id := int(time.Now().UnixNano() % 1000000)

	// Create a new obstacle
	obstacleDb := db.Obstacle{
		ID:          id,
		Position:    in.Position,
		Type:        in.Type,
		Description: in.Description,
		DangerLevel: in.DangerLevel,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	obstacleRepo := db.NewObstacleRepo()
	statusCode, err := obstacleRepo.CreateOrUpdate(&obstacleDb)
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

	return &apiObstacle, http.StatusCreated, nil
} 