package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"webhook/domain/db"
	"webhook/domain/s3"
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

	// Firebase認証（GET系・Valhalla系以外で）
	skipAuth :=
		(request.HTTPMethod == "GET" && (request.Resource == "/obstacles" || request.Resource == "/obstacles/{id}")) ||
		(request.HTTPMethod == "POST" && (request.Resource == "/route-with-obstacles" || request.Resource == "/locate" || request.Resource == "/trace_attributes" || request.Resource == "/trace_route" || request.Resource == "/isochrone"))

	authHeader := request.Headers["Authorization"]
	token, _, err := auth.ValidateFirebaseToken(ctx, authHeader)
	firebaseUID := ""
	userRole := "none"
	if !skipAuth {
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
			WayID:       createRequest.WayID,
			NearestDistance: createRequest.NearestDistance,
			NoNearbyRoad:  createRequest.NoNearbyRoad,
			UserID:      firebaseUID,
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
		obstacleRepo, _ := db.NewObstacleRepo(ctx)
		idInt, _ := strconv.Atoi(idStr)
		ob, _, _ := obstacleRepo.Get(ctx, idInt)
		if ob == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Obstacle not found", nil, nil)
		}
		if !(userRole == "admin" || (userRole == "editor" && ob.UserID == firebaseUID)) {
			return errorResponse(logger, request, http.StatusForbidden, "Forbidden", nil, nil)
		}

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
			WayID:       updateRequest.WayID,
			NearestDistance: updateRequest.NearestDistance,
			NoNearbyRoad:  updateRequest.NoNearbyRoad,
			UserID:      firebaseUID,
		}

		updatedObstacle, statusCode, err := usecase.UpdateObstacle(ctx, input, userRole)
		if err != nil {
			return errorResponse(logger, request, statusCode, err.Error(), nil, err)
		}

		return jsonResponse(statusCode, updatedObstacle)

	// DELETE /obstacles/{id} - Delete an obstacle
	case request.HTTPMethod == "DELETE" && request.Resource == "/obstacles/{id}":
		idStr := request.PathParameters["id"]
		obstacleRepo, _ := db.NewObstacleRepo(ctx)
		idInt, _ := strconv.Atoi(idStr)
		ob, _, _ := obstacleRepo.Get(ctx, idInt)
		if ob == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Obstacle not found", nil, nil)
		}
		if !(userRole == "admin" || (userRole == "editor" && ob.UserID == firebaseUID)) {
			return errorResponse(logger, request, http.StatusForbidden, "Forbidden", nil, nil)
		}
		input := input.ObstacleDelete{
			ID: idStr,
		}

		statusCode, err := usecase.DeleteObstacle(ctx, input, firebaseUID, userRole)
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
		obstacleRepo, _ := db.NewObstacleRepo(ctx)
		idInt, _ := strconv.Atoi(idStr)
		ob, _, _ := obstacleRepo.Get(ctx, idInt)
		if ob == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Obstacle not found", nil, nil)
		}
		if !(userRole == "admin" || (userRole == "editor" && ob.UserID == firebaseUID)) {
			return errorResponse(logger, request, http.StatusForbidden, "Forbidden", nil, nil)
		}
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
		obstacleRepo, _ := db.NewObstacleRepo(ctx)
		idInt, _ := strconv.Atoi(idStr)
		ob, _, _ := obstacleRepo.Get(ctx, idInt)
		if ob == nil {
			return errorResponse(logger, request, http.StatusNotFound, "Obstacle not found", nil, nil)
		}
		if !(userRole == "admin" || (userRole == "editor" && ob.UserID == firebaseUID)) {
			return errorResponse(logger, request, http.StatusForbidden, "Forbidden", nil, nil)
		}
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

		// 中継地点を変換
		var waypoints []input.Location
		for _, waypoint := range routeRequest.Waypoints {
			waypoints = append(waypoints, input.Location{
				Lat: waypoint.Lat,
				Lon: waypoint.Lon,
			})
		}

		// 回避地点を変換
		var excludeLocations []input.Location
		for _, exclude := range routeRequest.ExcludeLocations {
			excludeLocations = append(excludeLocations, input.Location{
				Lat: exclude.Lat,
				Lon: exclude.Lon,
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
			Waypoints:         waypoints,
			ExcludeLocations:  excludeLocations,
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

	// POST /locate - Proxy to Valhalla locate endpoint
	case request.HTTPMethod == "POST" && request.Resource == "/locate":
		return proxyToValhalla(ctx, request, logger, "locate")

	// POST /trace_attributes - Proxy to Valhalla trace_attributes endpoint
	case request.HTTPMethod == "POST" && request.Resource == "/trace_attributes":
		return proxyToValhalla(ctx, request, logger, "trace_attributes")

	// POST /trace_route - Proxy to Valhalla trace_route endpoint
	case request.HTTPMethod == "POST" && request.Resource == "/trace_route":
		return proxyToValhalla(ctx, request, logger, "trace_route")

	// POST /isochrone - Proxy to Valhalla isochrone endpoint
	case request.HTTPMethod == "POST" && request.Resource == "/isochrone":
		return proxyToValhalla(ctx, request, logger, "isochrone")

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

// proxyToValhalla はValhallaエンドポイントへのプロキシ処理を共通化する
func proxyToValhalla(ctx context.Context, request events.APIGatewayProxyRequest, logger *zap.Logger, endpoint string) (events.APIGatewayProxyResponse, error) {
	valhallaURL := fmt.Sprintf("http://133.167.121.88:8080/%s", endpoint)
	
	// HTTPクライアントを作成
	client := &http.Client{
		Timeout: time.Second * 30,
	}
	
	// リクエストを作成
	req, err := http.NewRequestWithContext(ctx, "POST", valhallaURL, bytes.NewBuffer([]byte(request.Body)))
	if err != nil {
		return errorResponse(logger, request, http.StatusInternalServerError, fmt.Sprintf("Failed to create request to Valhalla %s", endpoint), nil, err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	// Valhallaにリクエスト送信
	resp, err := client.Do(req)
	if err != nil {
		return errorResponse(logger, request, http.StatusInternalServerError, fmt.Sprintf("Failed to call Valhalla %s endpoint", endpoint), nil, err)
	}
	defer resp.Body.Close()
	
	// レスポンスボディを読み取り
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return errorResponse(logger, request, http.StatusInternalServerError, fmt.Sprintf("Failed to read Valhalla %s response", endpoint), nil, err)
	}
	
	// Valhallaのレスポンスをそのまま返す
	return events.APIGatewayProxyResponse{
		StatusCode: resp.StatusCode,
		Headers: map[string]string{
			"Content-Type":                "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(responseBody),
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
}
