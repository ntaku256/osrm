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
	GetTraceAttributes(ctx context.Context, req TraceAttributesRequest) (*TraceAttributesResponse, error)
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
		"costing":   "pedestrian",
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

// TraceAttributesRequestShapePoint型を追加
// {"lat":..., "lon":...}
type TraceAttributesRequestShapePoint struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type TraceAttributesRequest struct {
	Shape      []TraceAttributesRequestShapePoint `json:"shape"`
	Costing    string `json:"costing"`
	ShapeMatch string `json:"shape_match"`
	Filters    *TraceAttributesFilters `json:"filters,omitempty"`
}

type TraceAttributesFilters struct {
	Attributes []string `json:"attributes"`
}

type TraceAttributesResponse struct {
	Edges []struct {
		WayID  int64   `json:"way_id"`
		Length float64 `json:"length,omitempty"`
		Speed  float64 `json:"speed,omitempty"`
	} `json:"edges"`
	Shape string `json:"shape,omitempty"`
	// 必要に応じて他のフィールドも追加
}

// TraceAttributes呼び出し
func (r *valhallaRepo) GetTraceAttributes(ctx context.Context, req TraceAttributesRequest) (*TraceAttributesResponse, error) {
	url := fmt.Sprintf("%s/trace_attributes", r.baseURL)

	requestBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal trace_attributes request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create trace_attributes request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call trace_attributes: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("trace_attributes API returned status %d: %s", resp.StatusCode, string(body))
	}

	var traceResp TraceAttributesResponse
	if err := json.NewDecoder(resp.Body).Decode(&traceResp); err != nil {
		return nil, fmt.Errorf("failed to decode trace_attributes response: %w", err)
	}

	return &traceResp, nil
} 