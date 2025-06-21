package valhalla

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

type ValhallaRepo interface {
	GetRoute(ctx context.Context, request input.RouteWithObstacles) (*output.ValhallaRouteResponse, error)
}

type valhallaRepo struct {
	baseURL string
	client  *http.Client
}

func NewValhallaRepo() ValhallaRepo {
	return &valhallaRepo{
		baseURL: "http://133.167.121.88:8080",
		client: &http.Client{
			Timeout: time.Second * 30,
		},
	}
}

func (r *valhallaRepo) GetRoute(ctx context.Context, request input.RouteWithObstacles) (*output.ValhallaRouteResponse, error) {
	url := fmt.Sprintf("%s/route", r.baseURL)
	
	// Valhallaのリクエスト形式に変換
	valhallaRequest := map[string]interface{}{
		"locations": request.Locations,
		"language":  request.Language,
		"costing":   request.Costing,
	}
	
	requestBody, err := json.Marshal(valhallaRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Valhalla API returned status %d: %s", resp.StatusCode, string(body))
	}
	
	var valhallaResponse output.ValhallaRouteResponse
	if err := json.NewDecoder(resp.Body).Decode(&valhallaResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &valhallaResponse, nil
} 