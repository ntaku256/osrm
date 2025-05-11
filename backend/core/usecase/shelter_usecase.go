package usecase

import (
	"context"
	"fmt"

	"street-view/core/domain/model"
	"street-view/core/domain/repository"
	"street-view/core/pkg/validation"
)

// ShelterUseCase はシェルター関連のユースケースを扱います
type ShelterUseCase struct {
	repo repository.ShelterRepository
}

// NewShelterUseCase は新しいShelterUseCaseインスタンスを生成します
func NewShelterUseCase(repo repository.ShelterRepository) *ShelterUseCase {
	return &ShelterUseCase{
		repo: repo,
	}
}

// GetAllShelters は全てのシェルターを取得します
func (u *ShelterUseCase) GetAllShelters(ctx context.Context) (*model.ListShelterResponse, error) {
	shelters, err := u.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	return &model.ListShelterResponse{Items: shelters}, nil
}

// GetShelter は指定IDのシェルターを取得します
func (u *ShelterUseCase) GetShelter(ctx context.Context, id string) (*model.Shelter, error) {
	// IDのバリデーション
	params := validation.GetShelterParams{ID: id}
	if err := validation.ValidateStruct(params); err != nil {
		return nil, fmt.Errorf("invalid shelter ID: %w", err)
	}
	
	return u.repo.FindByID(ctx, id)
}

// CreateShelter は新しいシェルターを作成します
func (u *ShelterUseCase) CreateShelter(ctx context.Context, shelter model.Shelter) (*model.Shelter, error) {
	// バリデーション
	req := validation.CreateShelterRequest{
		Name:   shelter.Name,
		Lat:    shelter.Lat,
		Lng:    shelter.Lng,
		Height: shelter.Height,
	}
	
	if err := validation.ValidateStruct(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	return u.repo.Create(ctx, shelter)
}

// UpdateShelter は指定IDのシェルターを更新します
func (u *ShelterUseCase) UpdateShelter(ctx context.Context, shelter model.Shelter) (*model.Shelter, error) {
	// IDのバリデーション
	idParams := validation.UpdateShelterParams{ID: shelter.ID}
	if err := validation.ValidateStruct(idParams); err != nil {
		return nil, fmt.Errorf("invalid shelter ID: %w", err)
	}
	
	// シェルターデータのバリデーション
	req := validation.UpdateShelterRequest{
		Name:   shelter.Name,
		Lat:    shelter.Lat,
		Lng:    shelter.Lng,
		Height: shelter.Height,
	}
	
	if err := validation.ValidateStruct(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	// 存在確認
	_, err := u.repo.FindByID(ctx, shelter.ID)
	if err != nil {
		return nil, fmt.Errorf("shelter not found: %w", err)
	}
	
	return u.repo.Update(ctx, shelter)
}

// DeleteShelter は指定IDのシェルターを削除します
func (u *ShelterUseCase) DeleteShelter(ctx context.Context, id string) error {
	// IDのバリデーション
	params := validation.DeleteShelterParams{ID: id}
	if err := validation.ValidateStruct(params); err != nil {
		return fmt.Errorf("invalid shelter ID: %w", err)
	}
	
	// 存在確認
	_, err := u.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("shelter not found: %w", err)
	}
	
	return u.repo.Delete(ctx, id)
}
