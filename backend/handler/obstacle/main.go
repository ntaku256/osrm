package main

import (
	"context"
	"encoding/json"
	"net/http"

	"webhook/usecase"
	"webhook/usecase/input"
	"webhook/usecase/obstacle"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"go.uber.org/zap"
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	StatusCode int                `json:"status_code"`
	Message    string             `json:"message"`
	Errors     map[string][]string `json:"errors,omitempty"`
}

func HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// main.go のHandleRequestメソッドに追加
	if request.HTTPMethod == "OPTIONS" {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type,Authorization",
		},
	}, nil
	}

	// Handle different HTTP methods and paths
	switch {
	// GET /obstacles - List all obstacles
	case request.HTTPMethod == "GET" && request.Resource == "/obstacles":
		response, statusCode, err := usecase.GetObstacles(ctx, input.ObstacleGetAll{})
		if err != nil {
			return errorResponse(statusCode, err.Error(), nil)
		}

		return jsonResponse(statusCode, response)

	// POST /obstacles - Create a new obstacle
	case request.HTTPMethod == "POST" && request.Resource == "/obstacles":
		var createRequest obstacle.CreateObstacleRequest
		if err := json.Unmarshal([]byte(request.Body), &createRequest); err != nil {
			return errorResponse(http.StatusBadRequest, "Invalid request body", nil)
		}

		input := input.ObstacleCreate{
			Position:    createRequest.Position,
			Type:        createRequest.Type,
			Description: createRequest.Description,
			DangerLevel: createRequest.DangerLevel,
		}

		createdObstacle, statusCode, err := usecase.CreateObstacle(ctx, input)
		if err != nil {
			return errorResponse(statusCode, err.Error(), nil)
		}

		return jsonResponse(statusCode, createdObstacle)

	// GET /obstacles/{id} - Get an obstacle by ID
	case request.HTTPMethod == "GET" && request.Resource == "/obstacles/{id}":
		idStr := request.PathParameters["id"]
		input := input.ObstacleGetByID{
			ID: idStr,
		}

		foundObstacle, statusCode, err := usecase.GetObstacleByID(ctx, input)
		if err != nil {
			return errorResponse(statusCode, err.Error(), nil)
		}

		// Check if the obstacle was found
		if foundObstacle == nil {
			return errorResponse(http.StatusNotFound, "Obstacle not found", nil)
		}

		return jsonResponse(statusCode, foundObstacle)

	// PUT /obstacles/{id} - Update an obstacle
	case request.HTTPMethod == "PUT" && request.Resource == "/obstacles/{id}":
		idStr := request.PathParameters["id"]

		// Parse the request body
		var updateRequest obstacle.UpdateObstacleRequest
		if err := json.Unmarshal([]byte(request.Body), &updateRequest); err != nil {
			return errorResponse(http.StatusBadRequest, "Invalid request body", nil)
		}

		input := input.ObstacleUpdate{
			ID:          idStr,
			Position:    updateRequest.Position,
			Type:        updateRequest.Type,
			Description: updateRequest.Description,
			DangerLevel: updateRequest.DangerLevel,
		}

		updatedObstacle, statusCode, err := usecase.UpdateObstacle(ctx, input)
		if err != nil {
			return errorResponse(statusCode, err.Error(), nil)
		}

		return jsonResponse(statusCode, updatedObstacle)

	// DELETE /obstacles/{id} - Delete an obstacle
	case request.HTTPMethod == "DELETE" && request.Resource == "/obstacles/{id}":
		idStr := request.PathParameters["id"]
		input := input.ObstacleDelete{
			ID: idStr,
		}

		statusCode, err := usecase.DeleteObstacle(ctx, input)
		if err != nil {
			return errorResponse(statusCode, err.Error(), nil)
		}

		return events.APIGatewayProxyResponse{
			StatusCode: statusCode,
			Headers: map[string]string{
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		}, nil

	default:
		return errorResponse(http.StatusNotFound, "Not Found", nil)
	}
}

func jsonResponse(statusCode int, data interface{}) (events.APIGatewayProxyResponse, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return events.APIGatewayProxyResponse{}, err
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}

func errorResponse(statusCode int, message string, errors map[string][]string) (events.APIGatewayProxyResponse, error) {
	errorResp := ErrorResponse{
		StatusCode: statusCode,
		Message:    message,
		Errors:     errors,
	}

	body, err := json.Marshal(errorResp)
	if err != nil {
		return events.APIGatewayProxyResponse{}, err
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",

		},
		Body: string(body),
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
} 