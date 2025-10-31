package db

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type LatLng struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type WalkedRouteSummary struct {
	Cost                float64 `json:"cost"`
	HasFerry            bool    `json:"has_ferry"`
	HasHighway          bool    `json:"has_highway"`
	HasTimeRestrictions bool    `json:"has_time_restrictions"`
	HasToll             bool    `json:"has_toll"`
	Length              float64 `json:"length"`
	MaxLat              float64 `json:"max_lat"`
	MaxLon              float64 `json:"max_lon"`
	MinLat              float64 `json:"min_lat"`
	MinLon              float64 `json:"min_lon"`
	Time                float64 `json:"time"`
}

type WalkedRoute struct {
	ID           string              `json:"id" dynamodbav:"id"`
	UserID       string              `json:"user_id" dynamodbav:"user_id"`
	Shape        string              `json:"shape" dynamodbav:"shape"`
	Obstacles    []Obstacle          `json:"obstacles" dynamodbav:"obstacles"`
	RouteSummary *WalkedRouteSummary `json:"route_summary" dynamodbav:"route_summary"`
	StartTime    string              `json:"start_time" dynamodbav:"start_time"`
	EndTime      string              `json:"end_time" dynamodbav:"end_time"`
	Duration     int                 `json:"duration" dynamodbav:"duration"`
	Distance     float64             `json:"distance" dynamodbav:"distance"`
	TraceRaw     []LatLng            `json:"trace_raw" dynamodbav:"trace_raw"`
	Title        string              `json:"title" dynamodbav:"title"`
	CreatedAt    string              `json:"created_at" dynamodbav:"created_at"`
	UpdatedAt    string              `json:"updated_at" dynamodbav:"updated_at"`
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
		tableName = "dev-walked-routes-table"
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

func (r *WalkedRouteRepo) ListByUserID(ctx context.Context, userID string) ([]*WalkedRoute, error) {
	input := &dynamodb.QueryInput{
		TableName:              &r.tableName,
		IndexName:              aws.String("user_id-index"),
		KeyConditionExpression: aws.String("user_id = :uid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":uid": &types.AttributeValueMemberS{Value: userID},
		},
	}
	result, err := r.db.Query(ctx, input)
	if err != nil {
		return nil, err
	}
	var routes []*WalkedRoute
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &routes); err != nil {
		return nil, err
	}
	return routes, nil
} 