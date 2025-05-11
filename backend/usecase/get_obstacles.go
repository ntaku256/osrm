package usecase

import (
	"net/http"

	"webhook/domain/db"
	"webhook/usecase/input"
	"webhook/usecase/obstacle"
)

// GetObstacles retrieves all obstacles
func GetObstacles(ctx interface{}, in input.ObstacleGetAll) (*obstacle.ListObstacleResponse, int, error) {
	obstacleRepo := db.NewObstacleRepo()
	obstacles, statusCode, err := obstacleRepo.List()
	if err != nil {
		return nil, statusCode, err
	}

	// Convert DB obstacles to API obstacles
	var apiObstacles []obstacle.Obstacle
	for _, obstacleDb := range *obstacles {
		apiObstacle := obstacle.Obstacle{
			ID:          obstacleDb.ID,
			Position:    obstacleDb.Position,
			Type:        obstacleDb.Type,
			Description: obstacleDb.Description,
			DangerLevel: obstacleDb.DangerLevel,
			CreatedAt:   obstacleDb.CreatedAt,
		}
		apiObstacles = append(apiObstacles, apiObstacle)
	}

	response := &obstacle.ListObstacleResponse{
		Items: apiObstacles,
	}

	return response, http.StatusOK, nil
} 