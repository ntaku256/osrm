package usecase

import (
	"context"
	"net/http"
	"strconv"

	"webhook/domain/db"
	"webhook/domain/s3"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// UpdateObstacleImageS3Key updates the image_s3_key of an obstacle
func UpdateObstacleImageS3Key(ctx context.Context, input input.ObstacleUpdateImageS3Key) (*output.Obstacle, int, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	ob, statusCode, err := obstacleRepo.Get(ctx, id)
	if err != nil {
		return nil, statusCode, err
	}
	if ob == nil {
		return nil, http.StatusNotFound, nil
	}

	// 既存画像があれば削除
	if ob.ImageS3Key != "" && ob.ImageS3Key != input.ImageS3Key {
		s3Repo, err := s3.NewS3Repo()
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		_ = s3Repo.DeleteObject(ob.ImageS3Key)
	}

	ob.ImageS3Key = input.ImageS3Key
	statusCode, err = obstacleRepo.CreateOrUpdate(ctx, ob)
	if err != nil {
		return nil, statusCode, err
	}
	apiObstacle := adaptor.FromDBObstacle(ob)
	return &apiObstacle, http.StatusOK, nil
}
