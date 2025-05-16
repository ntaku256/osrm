package usecase

import (
	"context"
	"net/http"
	"time"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// CreateObstacle creates a new obstacle
func CreateObstacle(ctx context.Context, input input.ObstacleCreate) (*output.Obstacle, int, error) {
	// Generate a new ID
	// In a real application, you might use an auto-increment strategy or UUID
	id := int(time.Now().UnixNano() % 1000000)

	// Create a new obstacle
	obstacle := db.Obstacle{
		ID:          id,
		Position:    input.Position,
		Type:        input.Type,
		Description: input.Description,
		DangerLevel: input.DangerLevel,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	statusCode, err := obstacleRepo.CreateOrUpdate(ctx, &obstacle)
	if err != nil {
		return nil, statusCode, err
	}

	apiObstacle := adaptor.FromDBObstacle(&obstacle)
	return &apiObstacle, http.StatusCreated, nil
}
