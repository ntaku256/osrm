package input

type Location struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// ObstacleDetectionMethod は障害物検出方法を表す
type ObstacleDetectionMethod string

const (
	DetectionMethodNodes    ObstacleDetectionMethod = "nodes"    // nodes一致のみ
	DetectionMethodDistance ObstacleDetectionMethod = "distance" // 距離判定のみ
	DetectionMethodBoth     ObstacleDetectionMethod = "both"     // 両方
)

type RouteWithObstacles struct {
	Locations           []Location              `json:"locations"`
	Waypoints           []Location              `json:"waypoints,omitempty"`            // 中継地点
	ExcludeLocations    []Location              `json:"exclude_locations,omitempty"`    // 回避地点
	Language            string                  `json:"language,omitempty"`
	Costing             string                  `json:"costing,omitempty"`
	DetectionMethod     ObstacleDetectionMethod `json:"detection_method,omitempty"`     // 障害物検出方法
	DistanceThreshold   float64                 `json:"distance_threshold,omitempty"`   // 距離閾値（km）
} 