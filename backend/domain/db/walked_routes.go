package db

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

type WalkedRoute struct {
	ID           string        `json:"id"`
	UserID       string        `json:"user_id"`
	Shape        string        `json:"shape"`
	Obstacles    interface{}   `json:"obstacles"`
	RouteSummary interface{}   `json:"route_summary"`
	StartTime    string        `json:"start_time"`
	EndTime      string        `json:"end_time"`
	Duration     int           `json:"duration"`
	Distance     float64       `json:"distance"`
	TraceRaw     [][]float64   `json:"trace_raw"`
	Title        string        `json:"title"`
	CreatedAt    string        `json:"created_at"`
	UpdatedAt    string        `json:"updated_at"`
}

type WalkedRouteRepo struct {
	db        *dynamodb.Client
	tableName string
}

func NewWalkedRouteRepo(ctx context.Context) (*WalkedRouteRepo, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	db := dynamodb.NewFromConfig(cfg)
	tableName := os.Getenv("WALKED_ROUTES_TABLE_NAME")
	if tableName == "" {
		tableName = os.Getenv("ENV") + "-walked-routes-table"
	}
	return &WalkedRouteRepo{db: db, tableName: tableName}, nil
}

func (r *WalkedRouteRepo) Save(ctx context.Context, route *WalkedRoute) error {
	item, err := attributevalue.MarshalMap(route)
	if err != nil {
		return err
	}
	_, err = r.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &r.tableName,
		Item:      item,
	})
	return err
} 