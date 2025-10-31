package usecase

import (
	"context"
	"webhook/domain/db"
)

type GetWalkedRoutesByUserIDInput struct {
	UserID string
}

type GetWalkedRoutesByUserIDOutput struct {
	Routes []*db.WalkedRoute
}

func GetWalkedRoutesByUserID(ctx context.Context, input GetWalkedRoutesByUserIDInput) (*GetWalkedRoutesByUserIDOutput, error) {
	repo, err := db.NewWalkedRouteRepo(ctx)
	if err != nil {
		return nil, err
	}
	routes, err := repo.ListByUserID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	return &GetWalkedRoutesByUserIDOutput{Routes: routes}, nil
} 