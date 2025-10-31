package apiinput

type CreateUserRequest struct {
	Username        string `json:"username" validate:"required"`
	Age             int    `json:"age" validate:"required,min=1,max=120"`
	Gender          string `json:"gender" validate:"required,oneof=male female other"`
	HasDisability   bool   `json:"has_disability"`
	EvacuationLevel int    `json:"evacuation_level" validate:"required,min=1,max=5"`
}

type UpdateUserRequest struct {
	Username        string `json:"username" validate:"required"`
	Age             int    `json:"age" validate:"required,min=1,max=120"`
	Gender          string `json:"gender" validate:"required,oneof=male female other"`
	HasDisability   bool   `json:"has_disability"`
	EvacuationLevel int    `json:"evacuation_level" validate:"required,min=1,max=5"`
} 