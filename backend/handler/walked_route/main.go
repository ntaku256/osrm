package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/google/uuid"

	"webhook/domain/db"
	"webhook/shared/auth"
	"webhook/usecase"
	"webhook/usecase/adaptor"
	inputroute "webhook/usecase/input"
)

type LatLng struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type WalkedRouteInput struct {
	TracePoints []LatLng `json:"trace_points"`
	StartTime   string   `json:"start_time"`
	EndTime     string   `json:"end_time"`
	Title       string   `json:"title"`
}

func HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// OPTIONSリクエスト（CORSプリフライト）対応
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
				"Access-Control-Allow-Headers": "Content-Type,Authorization",
			},
			Body: "",
		}, nil
	}

	// 1. Firebase認証
	authHeader := request.Headers["Authorization"]
	token, _, err := auth.ValidateFirebaseToken(ctx, authHeader)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusUnauthorized,
			Body:       `{"message":"Unauthorized"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}
	userID := token.UID

	if request.HTTPMethod == "GET" {
		output, err := usecase.GetWalkedRoutesByUserID(ctx, usecase.GetWalkedRoutesByUserIDInput{UserID: userID})
		if err != nil {
			// 詳細なエラー内容を返す
			debugInfo := map[string]interface{}{
				"message": "DB query error",
				"error":   err.Error(),
			}
			debugBody, _ := json.Marshal(debugInfo)
			return events.APIGatewayProxyResponse{
				StatusCode: http.StatusInternalServerError,
				Body:       string(debugBody),
				Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
			}, nil
		}
		respBody, _ := json.Marshal(output.Routes)
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			Body: string(respBody),
		}, nil
	}

	// 2. リクエストbodyパース
	var input WalkedRouteInput
	err = json.Unmarshal([]byte(request.Body), &input)
	if err != nil || len(input.TracePoints) < 2 {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Body:       `{"message":"invalid input"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}

	// 3. Valhalla /trace_route呼び出し → usecase.GetRouteWithObstacles呼び出しに変更
	locations := make([]inputroute.Location, 0, len(input.TracePoints))
	for _, pt := range input.TracePoints {
		locations = append(locations, inputroute.Location{Lat: pt.Lat, Lon: pt.Lon})
	}
	routeReq := inputroute.RouteWithObstacles{
		Locations:         locations,
		Costing:           "pedestrian",
		DetectionMethod:   inputroute.DetectionMethodBoth,
		DistanceThreshold: 0.04, // 40m
	}
	routeResp, status, err := usecase.GetRouteWithObstacles(ctx, routeReq)
	if err != nil || routeResp == nil || len(routeResp.Trip.Legs) == 0 {
		debugInfo := map[string]interface{}{
			"message":      "route-with-obstacles error",
			"error":        err,
			"routeResp":    routeResp,
			"routeReq":     routeReq,
		}
		debugBody, _ := json.Marshal(debugInfo)
		return events.APIGatewayProxyResponse{
			StatusCode: status,
			Body:       string(debugBody),
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}

	shapeStr := routeResp.Trip.Legs[0].Shape
	summary := routeResp.Trip.Summary
	obstacles := routeResp.Trip.Obstacles
	distance := summary.Length
	duration := int(summary.Time)
	// summary (output.Summary) → db.WalkedRouteSummary
	summaryBytes, _ := json.Marshal(summary)
	var routeSummary db.WalkedRouteSummary
	json.Unmarshal(summaryBytes, &routeSummary)
	// obstacles ([]output.Obstacle) → []db.Obstacle
	obstaclesArr := make([]db.Obstacle, 0, len(obstacles))
	for _, o := range obstacles {
		if dbObs := adaptor.ToDBObstacle(o); dbObs != nil {
			obstaclesArr = append(obstaclesArr, *dbObs)
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	id := uuid.New().String()
	traceRaw := make([]db.LatLng, len(input.TracePoints))
	for i, p := range input.TracePoints {
		traceRaw[i] = db.LatLng{Lat: p.Lat, Lon: p.Lon}
	}
	walkedRoute := db.WalkedRoute{
		ID:           id,
		UserID:       userID,
		Shape:        shapeStr,
		Obstacles:    obstaclesArr,
		RouteSummary: &routeSummary,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Duration:     duration,
		Distance:     distance,
		TraceRaw:     traceRaw, // []db.LatLng
		Title:        input.Title,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// 5. DynamoDB保存
	repo, err := db.NewWalkedRouteRepo(ctx)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"message":"DB error"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}
	err = repo.Save(ctx, &walkedRoute)
	if err != nil {
		debugInfo := map[string]interface{}{
			"message": "DB save error",
			"error":   err.Error(),
			"item":    walkedRoute,
		}
		debugBody, _ := json.Marshal(debugInfo)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       string(debugBody),
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}

	// 6. レスポンス
	respBody, _ := json.Marshal(walkedRoute)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusCreated,
		Headers: map[string]string{
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(respBody),
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
} 