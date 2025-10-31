package main

import (
	"context"
	"encoding/json"
	"net/http"

	apiinput "webhook/pkg/api/input"
	"webhook/shared/auth"
	"webhook/usecase"
	usecaseinput "webhook/usecase/input"

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

	// Handle CORS preflight
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

	// Get Authorization header
	authHeader := request.Headers["Authorization"]
	if authHeader == "" {
		authHeader = request.Headers["authorization"] // Handle lowercase
	}

	// Validate Firebase token
	token, statusCode, err := auth.ValidateFirebaseToken(ctx, authHeader)
	if err != nil {
		return errorResponse(logger, request, statusCode, "Authentication failed: "+err.Error(), nil, err)
	}

	firebaseUID := token.UID

	// Handle different HTTP methods and paths
	switch {
	// POST /users - Create a new user (register)
	case request.HTTPMethod == "POST" && request.Resource == "/users":
		var createRequest apiinput.CreateUserRequest
		if err := json.Unmarshal([]byte(request.Body), &createRequest); err != nil {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body", nil, err)
		}

		input := usecaseinput.UserCreate{
			FirebaseUID:     firebaseUID,
			Username:        createRequest.Username,
			Age:             createRequest.Age,
			Gender:          createRequest.Gender,
			HasDisability:   createRequest.HasDisability,
			EvacuationLevel: createRequest.EvacuationLevel,
		}

		createdUser, statusCode, err := usecase.CreateUser(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return jsonResponse(statusCode, createdUser)

	// GET /users/me - Get current user profile
	case request.HTTPMethod == "GET" && request.Resource == "/users/me":
		input := usecaseinput.UserGetByFirebaseUID{
			FirebaseUID: firebaseUID,
		}

		foundUser, statusCode, err := usecase.GetUserByFirebaseUID(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		if foundUser == nil {
			return errorResponse(logger, request, http.StatusNotFound, "User not found", nil, nil)
		}

		return jsonResponse(statusCode, foundUser)

	// PUT /users/me - Update current user profile
	case request.HTTPMethod == "PUT" && request.Resource == "/users/me":
		var updateRequest apiinput.UpdateUserRequest
		if err := json.Unmarshal([]byte(request.Body), &updateRequest); err != nil {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body", nil, err)
		}

		input := usecaseinput.UserUpdate{
			FirebaseUID:     firebaseUID,
			Username:        updateRequest.Username,
			Age:             updateRequest.Age,
			Gender:          updateRequest.Gender,
			HasDisability:   updateRequest.HasDisability,
			EvacuationLevel: updateRequest.EvacuationLevel,
		}

		updatedUser, statusCode, err := usecase.UpdateUser(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return jsonResponse(statusCode, updatedUser)

	// DELETE /users/me - Delete current user
	case request.HTTPMethod == "DELETE" && request.Resource == "/users/me":
		input := usecaseinput.UserDelete{
			FirebaseUID: firebaseUID,
		}

		statusCode, err := usecase.DeleteUser(ctx, input)
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
			Body:       `{"error": "Failed to marshal response"}`,
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
	// Log the error for debugging
	if err != nil {
		logger.Error("Error processing request",
			zap.String("method", request.HTTPMethod),
			zap.String("path", request.Path),
			zap.String("resource", request.Resource),
			zap.Error(err),
		)
	}

	errorResponse := ErrorResponse{
		StatusCode: statusCode,
		Message:    message,
		Errors:     errors,
	}

	body, marshalErr := json.Marshal(errorResponse)
	if marshalErr != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"error": "Failed to marshal error response"}`,
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

func main() {
	lambda.Start(HandleRequest)
} 