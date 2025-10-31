package usecase

import (
	"context"
	"net/http"

	"webhook/domain/db"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// GetUserByFirebaseUID gets a user by Firebase UID
func GetUserByFirebaseUID(ctx context.Context, input input.UserGetByFirebaseUID) (*output.User, int, error) {
	userRepo, err := db.NewUserRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	dbUser, statusCode, err := userRepo.GetByFirebaseUID(ctx, input.FirebaseUID)
	if err != nil {
		return nil, statusCode, err
	}

	if dbUser == nil {
		return nil, http.StatusNotFound, nil
	}

	// Check if Firebase data has been deleted
	if dbUser.IsFirebaseDeleted {
		return nil, http.StatusNotFound, nil // Treat as not found for Firebase purposes
	}

	apiUser := adaptor.FromDBUser(dbUser)
	return &apiUser, http.StatusOK, nil
} 