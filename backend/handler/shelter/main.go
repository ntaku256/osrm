package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"webhook/domain/db"
	apiinput "webhook/pkg/api/input"
	"webhook/shared/auth"
	"webhook/usecase"
	"webhook/usecase/input"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"go.uber.org/zap"
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	StatusCode int                 `json:"status_code"`
	Message    string              `json:"message"`
	Errors     map[string][]string `json:"errors,omitempty"`
}

func HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// CORS handling
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type,Authorization",
			},
		}, nil
	}

	// Firebase認証（GET系以外で）
	authHeader := request.Headers["Authorization"]
	token, _, err := auth.ValidateFirebaseToken(ctx, authHeader)
	firebaseUID := ""
	userRole := "none"
	if !(request.HTTPMethod == "GET" && (request.Resource == "/shelters" || request.Resource == "/shelters/{id}")) {
		if err != nil {
			return events.APIGatewayProxyResponse{
				StatusCode: http.StatusUnauthorized,
				Body:       `{"message":"Unauthorized"}`,
				Headers: map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
			}, nil
		}
		firebaseUID = token.UID
		userRepo, _ := db.NewUserRepo(ctx)
		user, _, _ := userRepo.GetByFirebaseUID(ctx, firebaseUID)
		if user != nil {
			userRole = user.Role
		}
	}

	// Handle different HTTP methods and paths
	switch {
	// GET /shelters - List all shelters
	case request.HTTPMethod == "GET" && request.Resource == "/shelters":
		response, statusCode, err := usecase.GetShelters(ctx, input.ShelterGetAll{})
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}
		return jsonResponse(statusCode, response)

	// POST /shelters - Create a new shelter
	case request.HTTPMethod == "POST" && request.Resource == "/shelters":
		var createRequest apiinput.CreateShelterRequest
		if err := json.Unmarshal([]byte(request.Body), &createRequest); err != nil {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body", nil, err)
		}

		input := input.ShelterCreate{
			Name:                createRequest.Name,
			Lat:                 createRequest.Lat,
			Lon:                 createRequest.Lon,
			Address:             createRequest.Address,
			Elevation:           createRequest.Elevation,
			TsunamiSafetyLevel:  createRequest.TsunamiSafetyLevel,
			UserID:              firebaseUID,
		}

		createdShelter, statusCode, err := usecase.CreateShelter(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return jsonResponse(statusCode, createdShelter)

	// GET /shelters/{id} - Get a shelter by ID
	case request.HTTPMethod == "GET" && request.Resource == "/shelters/{id}":
		idStr := request.PathParameters["id"]
		input := input.ShelterGetByID{
			ID: idStr,
		}

		foundShelter, statusCode, err := usecase.GetShelterByID(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		// Check if the shelter was found
		if foundShelter == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Shelter not found", nil, nil)
		}

		return jsonResponse(statusCode, foundShelter)

	// PUT /shelters/{id} - Update a shelter
	case request.HTTPMethod == "PUT" && request.Resource == "/shelters/{id}":
		idStr := request.PathParameters["id"]
		shelterRepo, _ := db.NewShelterRepo(ctx)
		idInt, _ := strconv.Atoi(idStr)
		shelter, _, _ := shelterRepo.Get(ctx, idInt)
		if shelter == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Shelter not found", nil, nil)
		}
		if !(userRole == "admin" || (userRole == "editor" && shelter.UserID == firebaseUID)) {
			return errorResponse(logger, request, http.StatusForbidden, "Forbidden", nil, nil)
		}
		input := input.ShelterUpdate{
			ID:                  idStr,
			Name:                shelter.Name,
			Lat:                 shelter.Lat,
			Lon:                 shelter.Lon,
			Address:             shelter.Address,
			Elevation:           shelter.Elevation,
			TsunamiSafetyLevel:  shelter.TsunamiSafetyLevel,
			UserID:              firebaseUID,
		}

		updatedShelter, statusCode, err := usecase.UpdateShelter(ctx, input, userRole)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return jsonResponse(statusCode, updatedShelter)

	// DELETE /shelters/{id} - Delete a shelter
	case request.HTTPMethod == "DELETE" && request.Resource == "/shelters/{id}":
		idStr := request.PathParameters["id"]
		shelterRepo, _ := db.NewShelterRepo(ctx)
		idInt, _ := strconv.Atoi(idStr)
		shelter, _, _ := shelterRepo.Get(ctx, idInt)
		if shelter == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Shelter not found", nil, nil)
		}
		if !(userRole == "admin" || (userRole == "editor" && shelter.UserID == firebaseUID)) {
			return errorResponse(logger, request, http.StatusForbidden, "Forbidden", nil, nil)
		}
		input := input.ShelterDelete{
			ID: idStr,
		}

		statusCode, err := usecase.DeleteShelter(ctx, input, firebaseUID, userRole)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return events.APIGatewayProxyResponse{
			StatusCode: statusCode,
			Headers: map[string]string{
				"Content-Type":                "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		}, nil

	default:
		return errorResponse(logger, request, http.StatusNotFound, "Endpoint not found", nil, nil)
	}
}

func jsonResponse(statusCode int, data interface{}) (events.APIGatewayProxyResponse, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Headers: map[string]string{
				"Content-Type":                "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			Body: `{"error": "Internal server error"}`,
		}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type":                "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}

func errorResponse(logger *zap.Logger, request events.APIGatewayProxyRequest, statusCode int, message string, errors map[string][]string, err error) (events.APIGatewayProxyResponse, error) {
	// Log the error
	logger.Error("API Error",
		zap.Int("status_code", statusCode),
		zap.String("message", message),
		zap.String("method", request.HTTPMethod),
		zap.String("path", request.Path),
		zap.String("resource", request.Resource),
		zap.Any("path_parameters", request.PathParameters),
		zap.String("body", request.Body),
		zap.Error(err),
	)

	errorResp := ErrorResponse{
		StatusCode: statusCode,
		Message:    message,
		Errors:     errors,
	}

	body, _ := json.Marshal(errorResp)

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type":                "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
} 