package usecase

import (
	"context"
	"net/http"

	"webhook/domain/db"
	"webhook/usecase/input"
)

// DeleteUser soft deletes Firebase data while keeping user information
func DeleteUser(ctx context.Context, input input.UserDelete) (int, error) {
	userRepo, err := db.NewUserRepo(ctx)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	// Check if user exists
	existingUser, statusCode, err := userRepo.GetByFirebaseUID(ctx, input.FirebaseUID)
	if err != nil {
		return statusCode, err
	}

	if existingUser == nil {
		return http.StatusNotFound, nil
	}

	// Check if already deleted
	if existingUser.IsFirebaseDeleted {
		return http.StatusNotFound, nil // Treat as not found for Firebase purposes
	}

	// Soft delete Firebase data only
	statusCode, err = userRepo.SoftDeleteFirebaseData(ctx, input.FirebaseUID)
	if err != nil {
		return statusCode, err
	}

	return http.StatusOK, nil
} 