package main

import (
	"context"
	"encoding/json"
	"net/http"
	"webhook/usecase"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

type EvacuationRouteRequest struct {
	CurrentPos struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
	} `json:"current_pos"`
	EvacuationLevel int `json:"evacuation_level"`
}

type EvacuationRouteResponse struct {
	NearestShelter interface{} `json:"nearest_shelter"`
	Route          interface{} `json:"route"`
}

func HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "OPTIONS,POST",
				"Access-Control-Allow-Headers": "Content-Type,Authorization",
			},
			Body: "",
		}, nil
	}
	if request.HTTPMethod != "POST" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusMethodNotAllowed,
			Body:       `{"message":"Method Not Allowed"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}
	var input EvacuationRouteRequest
	if err := json.Unmarshal([]byte(request.Body), &input); err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Body:       `{"message":"Invalid input"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}
	output, err := usecase.GetEvacuationRoute(ctx, usecase.GetEvacuationRouteInput{
		CurrentPos:      [2]float64{input.CurrentPos.Lat, input.CurrentPos.Lon},
		EvacuationLevel: input.EvacuationLevel,
	})
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       `{"message":"Evacuation route error"}`,
			Headers:    map[string]string{"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
		}, nil
	}
	respBody, _ := json.Marshal(EvacuationRouteResponse{
		NearestShelter: output.NearestShelter,
		Route:          output.Route,
	})
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type":                "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(respBody),
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
} 