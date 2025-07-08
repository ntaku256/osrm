package adaptor

import (
	"webhook/domain/db"
	"webhook/usecase/output"
)

// Convert from API model to DB model
func ToDBUser(user output.User) *db.User {
	return &db.User{
		FirebaseUID:       user.FirebaseUID,
		Username:          user.Username,
		Age:               user.Age,
		Gender:            user.Gender,
		HasDisability:     user.HasDisability,
		EvacuationLevel:   user.EvacuationLevel,
		IsFirebaseDeleted: user.IsFirebaseDeleted,
		CreatedAt:         user.CreatedAt,
		UpdatedAt:         user.UpdatedAt,
	}
}

// Convert from DB model to API model
func FromDBUser(dbUser *db.User) output.User {
	return output.User{
		FirebaseUID:       dbUser.FirebaseUID,
		Username:          dbUser.Username,
		Age:               dbUser.Age,
		Gender:            dbUser.Gender,
		HasDisability:     dbUser.HasDisability,
		EvacuationLevel:   dbUser.EvacuationLevel,
		IsFirebaseDeleted: dbUser.IsFirebaseDeleted,
		CreatedAt:         dbUser.CreatedAt,
		UpdatedAt:         dbUser.UpdatedAt,
		Role:              dbUser.Role,
	}
} 