package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/google/uuid"

	"webhook/domain/db"
	"webhook/shared/auth"
)

type WalkedRouteInput struct {
	TracePoints [][]float64 `json:"trace_points"`
	StartTime   string      `json:"start_time"`
	EndTime     string      `json:"end_time"`
	Title       string      `json:"title"`
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

	// 3. Valhalla /trace_route呼び出し
	valhallaURL := os.Getenv("VALHALLA_URL")
	if valhallaURL == "" {
		valhallaURL = "http://133.167.121.88:8080/trace_route"
	}
	// TracePointsを[{lat, lon}, ...]形式に変換
	shape := make([]map[string]float64, 0, len(input.TracePoints))
	for _, pt := range input.TracePoints {
		if len(pt) == 2 {
			shape = append(shape, map[string]float64{
				"lat": pt[0],
				"lon": pt[1],
			})
		}
	}
	valhallaReq := map[string]interface{}{
		"shape": shape,
		"costing": "pedestrian",
	}
	valhallaBody, _ := json.Marshal(valhallaReq)
	resp, err := http.Post(valhallaURL, "application/json", bytes.NewBuffer(valhallaBody))
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadGateway,
			Body:       `{"message":"Valhalla error"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}
	defer resp.Body.Close()
	respBytes, _ := ioutil.ReadAll(resp.Body)
	var valhallaResp struct {
		Trip struct {
			Legs []struct {
				Shape string `json:"shape"`
			} `json:"legs"`
			Summary   map[string]interface{} `json:"summary"`
			Obstacles interface{}           `json:"obstacles"`
		} `json:"trip"`
	}
	err = json.Unmarshal(respBytes, &valhallaResp)
	if err != nil || len(valhallaResp.Trip.Legs) == 0 {
		// デバッグ用にリクエスト・レスポンス内容を返す
		debugInfo := map[string]interface{}{
			"message":      "Valhalla parse error",
			"valhallaResp": string(respBytes), // 生レスポンス
			"valhallaReq":  valhallaReq,       // リクエスト内容
		}
		debugBody, _ := json.Marshal(debugInfo)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadGateway,
			Body:       string(debugBody),
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}

	// 4. WalkedRoute構築
	shape = valhallaResp.Trip.Legs[0].Shape
	summary := valhallaResp.Trip.Summary
	obstacles := valhallaResp.Trip.Obstacles
	distance := 0.0
	duration := 0
	if summary != nil {
		if v, ok := summary["length"].(float64); ok {
			distance = v
		}
		if v, ok := summary["time"].(float64); ok {
			duration = int(v)
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	id := uuid.New().String()
	walkedRoute := db.WalkedRoute{
		ID:           id,
		UserID:       userID,
		Shape:        shape,
		Obstacles:    obstacles,
		RouteSummary: summary,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Duration:     duration,
		Distance:     distance,
		TraceRaw:     input.TracePoints,
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
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"message":"DB save error"}`,
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