package repository

import (
	"context"

	"street-view/core/domain/model"
)

// ShelterRepository はシェルター情報のリポジトリインターフェースです
type ShelterRepository interface {
	FindAll(ctx context.Context) ([]model.Shelter, error)
	FindByID(ctx context.Context, id string) (*model.Shelter, error)
	Create(ctx context.Context, shelter model.Shelter) (*model.Shelter, error)
	Update(ctx context.Context, shelter model.Shelter) (*model.Shelter, error)
	Delete(ctx context.Context, id string) error
}
