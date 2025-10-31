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

// CreateUser creates a new user
func CreateUser(ctx context.Context, input input.UserCreate) (*output.User, int, error) {
	// Create a new user
	user := db.User{
		FirebaseUID:       input.FirebaseUID,
		Username:          input.Username,
		Age:               input.Age,
		Gender:            input.Gender,
		HasDisability:     input.HasDisability,
		EvacuationLevel:   input.EvacuationLevel,
		IsFirebaseDeleted: false, // 新規ユーザーは削除されていない
		Role:              "none",
		CreatedAt:         time.Now().Format(time.RFC3339),
		UpdatedAt:         time.Now().Format(time.RFC3339),
	}

	userRepo, err := db.NewUserRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	statusCode, err := userRepo.CreateOrUpdate(ctx, &user)
	if err != nil {
		return nil, statusCode, err
	}

	apiUser := adaptor.FromDBUser(&user)
	return &apiUser, http.StatusCreated, nil
} 