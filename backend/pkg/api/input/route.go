package apiinput

type RouteLocation struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type RouteWithObstaclesRequest struct {
	Locations           []RouteLocation `json:"locations"`
	Language            string          `json:"language,omitempty"`
	Costing             string          `json:"costing,omitempty"`
	DetectionMethod     string          `json:"detection_method,omitempty"`     // 障害物検出方法
	DistanceThreshold   float64         `json:"distance_threshold,omitempty"`   // 距離閾値（km）
}

type LocationRequest struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
} 