package usecase

import (
	"context"
	"net/http"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// GetObstacles retrieves all obstacles
func GetObstacles(ctx context.Context, input input.ObstacleGetAll) (*output.ListObstacleResponse, int, error) {
	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	obstacles, statusCode, err := obstacleRepo.List(ctx)
	if err != nil {
		return nil, statusCode, err
	}

	// Convert DB obstacles to API obstacles
	var apiObstacles []output.Obstacle
	for _, obstacle := range *obstacles {
		apiObstacles = append(apiObstacles, adaptor.FromDBObstacle(&obstacle))
	}

	response := &output.ListObstacleResponse{
		Items: apiObstacles,
	}

	return response, http.StatusOK, nil
}
