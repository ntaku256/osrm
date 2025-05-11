package validation

import (
	"github.com/go-playground/validator/v10"
)

type Shelter struct {
	Name   string  `validate:"required,max=255"`
	Lat    float32 `validate:"required,gte=-90,lte=90"`
	Lng    float32 `validate:"required,gte=-180,lte=180"`
	Height float32 `validate:"required,gte=0"`
}

type CreateShelterRequest struct {
	Name   string  `validate:"required,max=255"`
	Lat    float32 `validate:"required,gte=-90,lte=90"`
	Lng    float32 `validate:"required,gte=-180,lte=180"`
	Height float32 `validate:"required,gte=0"`
}

type UpdateShelterRequest struct {
	Name   string  `validate:"required,max=255"`
	Lat    float32 `validate:"required,gte=-90,lte=90"`
	Lng    float32 `validate:"required,gte=-180,lte=180"`
	Height float32 `validate:"required,gte=0"`
}

type GetShelterParams struct {
	ID string `validate:"required"`
}

type DeleteShelterParams struct {
	ID string `validate:"required"`
}

type UpdateShelterParams struct {
	ID string `validate:"required"`
}

var validate = validator.New()

func ValidateStruct(s interface{}) error {
	// Perform validation based on struct tags
	return validate.Struct(s)
}
