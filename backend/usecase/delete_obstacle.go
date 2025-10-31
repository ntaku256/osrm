package usecase

import (
	"context"
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/domain/s3"
	"webhook/usecase/input"
)

// DeleteObstacle deletes an obstacle by ID
func DeleteObstacle(ctx context.Context, input input.ObstacleDelete, userID string, userRole string) (int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return http.StatusBadRequest, err
	}

	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	ob, _, err := obstacleRepo.Get(ctx, id)
	if ob == nil {
		return http.StatusNotFound, nil
	}
	// 認可判定
	if !(userRole == "admin" || (userRole == "editor" && ob.UserID == userID)) {
		return http.StatusForbidden, nil
	}
	if err == nil && ob != nil && ob.ImageS3Key != "" {
		s3Repo, err := s3.NewS3Repo()
		if err != nil {
			return http.StatusInternalServerError, err
		}
		_ = s3Repo.DeleteObject(ob.ImageS3Key)
	}
	statusCode, err := obstacleRepo.Delete(ctx, id)
	if err != nil {
		return statusCode, err
	}

	return http.StatusNoContent, nil
}
