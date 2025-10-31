package usecase

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"os"
	"webhook/domain/db"
)

type GetEvacuationRouteInput struct {
	CurrentPos      [2]float64
	EvacuationLevel int
}

type GetEvacuationRouteOutput struct {
	NearestShelter *db.Shelter
	Route          interface{}
}

func GetEvacuationRoute(ctx context.Context, input GetEvacuationRouteInput) (*GetEvacuationRouteOutput, error) {
	shelterRepo, err := db.NewShelterRepo(ctx)
	if err != nil {
		return nil, err
	}
	shelters, _, err := shelterRepo.List(ctx)
	if err != nil || shelters == nil || len(*shelters) == 0 {
		return nil, err
	}
	// 最寄り避難所を計算
	minDist := math.MaxFloat64
	var nearest *db.Shelter
	for _, s := range *shelters {
		d := math.Pow(input.CurrentPos[0]-s.Lat, 2) + math.Pow(input.CurrentPos[1]-s.Lon, 2)
		if d < minDist {
			minDist = d
			nearest = &s
		}
	}
	if nearest == nil {
		return nil, nil
	}
	// dangerLevel回避ロジック付きルート検索
	excludeLocations := []map[string]float64{}
	var bestRoute interface{}
	bestDangerSum := math.MaxFloat64
	attempts := 0
	for attempts < 3 {
		attempts++
		// ルート検索API呼び出し（内部APIや外部APIに合わせて修正）
		route, err := GetRouteWithObstaclesRaw(ctx, input.CurrentPos, [2]float64{nearest.Lat, nearest.Lon}, excludeLocations)
		if err != nil || route == nil {
			break
		}
		obstacles := extractObstacles(route)
		highDanger := filterHighDanger(obstacles, input.EvacuationLevel)
		dangerSum := sumDangerLevel(obstacles)
		if dangerSum < bestDangerSum {
			bestDangerSum = dangerSum
			bestRoute = route
		}
		if len(highDanger) > 0 && attempts < 3 {
			for _, o := range highDanger {
				lat, _ := o["position"].([]interface{})[0].(float64)
				lon, _ := o["position"].([]interface{})[1].(float64)
				excludeLocations = append(excludeLocations, map[string]float64{"lat": lat, "lon": lon})
			}
			continue
		} else {
			break
		}
	}
	return &GetEvacuationRouteOutput{
		NearestShelter: nearest,
		Route:          bestRoute,
	}, nil
}

// --- ヘルパー関数（仮実装） ---
func GetRouteWithObstaclesRaw(ctx context.Context, start, end [2]float64, exclude []map[string]float64) (map[string]interface{}, error) {
	valhallaURL := os.Getenv("VALHALLA_ROUTE_WITH_OBSTACLES_URL")
	if valhallaURL == "" {
		valhallaURL = "https://27harw9i2h.execute-api.ap-northeast-1.amazonaws.com/api/route-with-obstacles"
	}
	body := map[string]interface{}{
		"locations": []map[string]float64{
			{"lat": start[0], "lon": start[1]},
			{"lat": end[0], "lon": end[1]},
		},
		"costing": "pedestrian",
		"language": "ja-JP",
	}
	if len(exclude) > 0 {
		body["exclude_locations"] = exclude
	}
	jsonBody, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", valhallaURL, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func extractObstacles(route map[string]interface{}) []map[string]interface{} {
	trip, ok := route["trip"].(map[string]interface{})
	if !ok {
		return nil
	}
	obstacles, ok := trip["obstacles"].([]interface{})
	if !ok {
		return nil
	}
	var obs []map[string]interface{}
	for _, o := range obstacles {
		if m, ok := o.(map[string]interface{}); ok {
			obs = append(obs, m)
		}
	}
	return obs
}

func filterHighDanger(obs []map[string]interface{}, level int) []map[string]interface{} {
	var high []map[string]interface{}
	for _, o := range obs {
		if danger, ok := o["dangerLevel"].(float64); ok && int(danger) > level {
			high = append(high, o)
		}
	}
	return high
}

func sumDangerLevel(obs []map[string]interface{}) float64 {
	sum := 0.0
	for _, o := range obs {
		if danger, ok := o["dangerLevel"].(float64); ok {
			sum += danger
		}
	}
	return sum
} 