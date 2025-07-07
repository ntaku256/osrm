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

// UpdateUser updates an existing user
func UpdateUser(ctx context.Context, input input.UserUpdate) (*output.User, int, error) {
	userRepo, err := db.NewUserRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	// Check if user exists
	existingUser, statusCode, err := userRepo.GetByFirebaseUID(ctx, input.FirebaseUID)
	if err != nil {
		return nil, statusCode, err
	}

	if existingUser == nil {
		return nil, http.StatusNotFound, nil
	}

	// Update user
	user := db.User{
		FirebaseUID:       input.FirebaseUID,
		Username:          input.Username,
		Age:               input.Age,
		Gender:            input.Gender,
		HasDisability:     input.HasDisability,
		EvacuationLevel:   input.EvacuationLevel,
		IsFirebaseDeleted: existingUser.IsFirebaseDeleted, // Keep existing Firebase deletion status
		CreatedAt:         existingUser.CreatedAt,         // Keep original creation time
		UpdatedAt:         time.Now().Format(time.RFC3339),
	}

	statusCode, err = userRepo.CreateOrUpdate(ctx, &user)
	if err != nil {
		return nil, statusCode, err
	}

	apiUser := adaptor.FromDBUser(&user)
	return &apiUser, http.StatusOK, nil
} 