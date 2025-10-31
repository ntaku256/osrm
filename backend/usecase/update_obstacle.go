package usecase

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// UpdateObstacle updates an existing obstacle
func UpdateObstacle(ctx context.Context, input input.ObstacleUpdate, userRole string) (*output.Obstacle, int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	// Check if the obstacle exists
	ob, statusCode, err := obstacleRepo.Get(ctx, id)
	if err != nil {
		return nil, statusCode, err
	}
	if ob == nil {
		return nil, http.StatusNotFound, nil
	}

	// 認可判定
	if ob.UserID == "" {
		if userRole != "admin" {
			return nil, http.StatusForbidden, nil
		}
	} else {
		if !(userRole == "admin" || (userRole == "editor" && ob.UserID == input.UserID)) {
			return nil, http.StatusForbidden, nil
		}
	}

	// Update the obstacle
	obstacle := db.Obstacle{
		ID:          id,
		Position:    input.Position,
		Type:        input.Type,
		Description: input.Description,
		DangerLevel: input.DangerLevel,
		Nodes:       input.Nodes,
		WayID:       input.WayID,
		NearestDistance: input.NearestDistance,
		NoNearbyRoad:  input.NoNearbyRoad,
		UserID:      input.UserID,
		CreatedAt:   time.Now().Format(time.RFC3339), // Update the timestamp
	}

	statusCode, err = obstacleRepo.CreateOrUpdate(ctx, &obstacle)
	if err != nil {
		return nil, statusCode, err
	}

	apiObstacle := adaptor.FromDBObstacle(&obstacle)
	return &apiObstacle, http.StatusOK, nil
}
