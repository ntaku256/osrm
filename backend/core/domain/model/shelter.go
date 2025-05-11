package model

// Shelter はシェルター情報を表すドメインモデルです
type Shelter struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Lat    float32 `json:"lat"`
	Lng    float32 `json:"lng"`
	Height float32 `json:"height"`
}

// ListShelterResponse はシェルター一覧のレスポンスを表します
type ListShelterResponse struct {
	Items []Shelter `json:"items"`
}
