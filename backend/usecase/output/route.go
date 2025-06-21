package output

// ValhallaRouteResponse は Valhalla APIからのレスポンス構造
type ValhallaRouteResponse struct {
	Trip    Trip         `json:"trip"`
	Admins  []Admin      `json:"admins"`
	Units   string       `json:"units"`
	Language string      `json:"language"`
	Obstacles []Obstacle `json:"obstacles,omitempty"` // 追加: ルート上の障害物
}

type Trip struct {
	Locations []LocationInfo `json:"locations"`
	Legs      []Leg          `json:"legs"`
	Summary   Summary        `json:"summary"`
	StatusMessage string      `json:"status_message"`
	Status        int         `json:"status"`
	Units         string      `json:"units"`
	Language      string      `json:"language"`
}

type LocationInfo struct {
	Type               string    `json:"type"`
	Lat                float64   `json:"lat"`
	Lon                float64   `json:"lon"`
	OriginalIndex      int       `json:"original_index"`
	WayId              int64     `json:"way_id,omitempty"`
	Distance           float64   `json:"distance,omitempty"`
}

type Leg struct {
	Maneuvers []Maneuver `json:"maneuvers"`
	Summary   Summary    `json:"summary"`
	Shape     string     `json:"shape"`
}

type Maneuver struct {
	Type               int       `json:"type"`
	Instruction        string    `json:"instruction"`
	VerbalInstruction  string    `json:"verbal_transition_alert_instruction,omitempty"`
	VerbalSuccinctTransitionInstruction string `json:"verbal_succinct_transition_instruction,omitempty"`
	VerbalPreTransitionInstruction      string `json:"verbal_pre_transition_instruction,omitempty"`
	VerbalPostTransitionInstruction     string `json:"verbal_post_transition_instruction,omitempty"`
	StreetNames        []string  `json:"street_names,omitempty"`
	BearingBefore      int       `json:"bearing_before,omitempty"`
	BearingAfter       int       `json:"bearing_after,omitempty"`
	Time               float64   `json:"time"`
	Length             float64   `json:"length"`
	Cost               float64   `json:"cost"`
	BeginShapeIndex    int       `json:"begin_shape_index"`
	EndShapeIndex      int       `json:"end_shape_index"`
	TravelMode         string    `json:"travel_mode,omitempty"`
	TravelType         string    `json:"travel_type,omitempty"`
	HasTimeRestrictions bool     `json:"has_time_restrictions,omitempty"`
}

type Summary struct {
	HasTimeRestrictions bool    `json:"has_time_restrictions"`
	HasToll             bool    `json:"has_toll"`
	HasHighway          bool    `json:"has_highway"`
	HasFerry            bool    `json:"has_ferry"`
	MinLat              float64 `json:"min_lat"`
	MinLon              float64 `json:"min_lon"`
	MaxLat              float64 `json:"max_lat"`
	MaxLon              float64 `json:"max_lon"`
	Time                float64 `json:"time"`
	Length              float64 `json:"length"`
	Cost                float64 `json:"cost"`
}

type Admin struct {
	AdminLevel int    `json:"admin_level"`
	Iso31661Alpha3 string `json:"iso_3166_1_alpha3"`
	Iso31661   string `json:"iso_3166_1"`
} 