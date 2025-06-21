package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"webhook/domain/s3"
	apiinput "webhook/pkg/api/input"
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

	// main.go のHandleRequestメソッドに追加
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

	// Handle different HTTP methods and paths
	switch {
	// GET /obstacles - List all obstacles
	case request.HTTPMethod == "GET" && request.Resource == "/obstacles":
		response, statusCode, err := usecase.GetObstacles(ctx, input.ObstacleGetAll{})
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}
		return jsonResponse(statusCode, response)

	// POST /obstacles - Create a new obstacle
	case request.HTTPMethod == "POST" && request.Resource == "/obstacles":
		var createRequest apiinput.CreateObstacleRequest
		if err := json.Unmarshal([]byte(request.Body), &createRequest); err != nil {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body", nil, err)
		}

		input := input.ObstacleCreate{
			Position:    createRequest.Position,
			Type:        createRequest.Type,
			Description: createRequest.Description,
			DangerLevel: createRequest.DangerLevel,
			Nodes:       createRequest.Nodes,
			NearestDistance: createRequest.NearestDistance,
			NoNearbyRoad:  createRequest.NoNearbyRoad,
		}

		createdObstacle, statusCode, err := usecase.CreateObstacle(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
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
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		// Check if the obstacle was found
		if foundObstacle == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Obstacle not found", nil, nil)
		}

		return jsonResponse(statusCode, foundObstacle)

	// PUT /obstacles/{id} - Update an obstacle
	case request.HTTPMethod == "PUT" && request.Resource == "/obstacles/{id}":
		idStr := request.PathParameters["id"]

		// Parse the request body
		var updateRequest apiinput.UpdateObstacleRequest
		if err := json.Unmarshal([]byte(request.Body), &updateRequest); err != nil {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body", nil, err)
		}

		input := input.ObstacleUpdate{
			ID:          idStr,
			Position:    updateRequest.Position,
			Type:        updateRequest.Type,
			Description: updateRequest.Description,
			DangerLevel: updateRequest.DangerLevel,
			Nodes:       updateRequest.Nodes,
			NearestDistance: updateRequest.NearestDistance,
			NoNearbyRoad:  updateRequest.NoNearbyRoad,
		}

		updatedObstacle, statusCode, err := usecase.UpdateObstacle(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
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
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return events.APIGatewayProxyResponse{
			StatusCode: statusCode,
			Headers: map[string]string{
				"Content-Type":                "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		}, nil

	// POST /obstacles/{id}/image-upload - Generate presigned URL for image upload
	case request.HTTPMethod == "POST" && request.Resource == "/obstacles/{id}/image-upload":
		idStr := request.PathParameters["id"]
		var req struct {
			Filename string `json:"filename"`
		}
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil || req.Filename == "" {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body or missing filename", nil, err)
		}

		// s3Keyを obstacles/{id}_{filename} 形式で生成
		s3Key := fmt.Sprintf("obstacles/%s_%s", idStr, req.Filename)

		s3Repo, err := s3.NewS3Repo()
		if err != nil {
			return errorResponse(logger, request, http.StatusInternalServerError, "Failed to create S3 repository", nil, err)
		}

		url, err := s3Repo.GeneratePresignedPUTURL(s3Key)
		if err != nil {
			return errorResponse(logger, request, http.StatusInternalServerError, "Failed to generate presigned URL", nil, err)
		}
		return jsonResponse(http.StatusOK, map[string]string{"url": url, "image_s3_key": s3Key})

	// PUT /obstacles/{id}/image - Save image_s3_key to obstacle
	case request.HTTPMethod == "PUT" && request.Resource == "/obstacles/{id}/image":
		idStr := request.PathParameters["id"]
		var req struct {
			ImageS3Key string `json:"image_s3_key"`
		}
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil || req.ImageS3Key == "" {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body or missing image_s3_key", nil, err)
		}

		input := input.ObstacleUpdateImageS3Key{
			ID:         idStr,
			ImageS3Key: req.ImageS3Key,
		}
		updatedObstacle, statusCode, err := usecase.UpdateObstacleImageS3Key(ctx, input)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}
		return jsonResponse(statusCode, updatedObstacle)

	// POST /route-with-obstacles - Get route with obstacles
	case request.HTTPMethod == "POST" && request.Resource == "/route-with-obstacles":
		var routeRequest apiinput.RouteWithObstaclesRequest
		if err := json.Unmarshal([]byte(request.Body), &routeRequest); err != nil {
			return errorResponse(logger, request, http.StatusBadRequest, "Invalid request body", nil, err)
		}

		// API入力をUsecase入力に変換
		var locations []input.Location
		for _, loc := range routeRequest.Locations {
			locations = append(locations, input.Location{
				Lat: loc.Lat,
				Lon: loc.Lon,
			})
		}

		// デフォルト値を設定
		detectionMethod := input.DetectionMethodDistance
		if routeRequest.DetectionMethod != "" {
			detectionMethod = input.ObstacleDetectionMethod(routeRequest.DetectionMethod)
		}
		
		distanceThreshold := 0.02 // デフォルト20m
		if routeRequest.DistanceThreshold > 0 {
			distanceThreshold = routeRequest.DistanceThreshold
		}

		usecaseInput := input.RouteWithObstacles{
			Locations:         locations,
			Language:          routeRequest.Language,
			Costing:           routeRequest.Costing,
			DetectionMethod:   detectionMethod,
			DistanceThreshold: distanceThreshold,
		}

		routeResponse, statusCode, err := usecase.GetRouteWithObstacles(ctx, usecaseInput)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return jsonResponse(statusCode, routeResponse)

	default:
		return errorResponse(logger, request, http.StatusNotFound, "Not Found", nil, nil)
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
			Body: err.Error(),
		}, err
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
	logger.Error("API error",
		zap.String("path", request.Path),
		zap.String("resource", request.Resource),
		zap.String("method", request.HTTPMethod),
		zap.Int("status", statusCode),
		zap.String("message", message),
		zap.Any("errors", errors),
		zap.Error(err),
	)

	errorResp := ErrorResponse{
		StatusCode: statusCode,
		Message:    message,
		Errors:     errors,
	}

	body, err2 := json.Marshal(errorResp)
	if err2 != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Headers: map[string]string{
				"Content-Type":                "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			Body: err2.Error(),
		}, err2
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
