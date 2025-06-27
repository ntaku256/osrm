package db

import (
	"context"
	"fmt"
	"net/http"

	"webhook/shared/util"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type ObstacleRepo struct {
	TableName string
	Client    *dynamodb.Client
}

func NewObstacleRepo(ctx context.Context) (*ObstacleRepo, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	obstacleRepo := util.GetSetting().ObstacleTable
	return &ObstacleRepo{
		TableName: obstacleRepo.TableName,
		Client:    dynamodb.NewFromConfig(cfg),
	}, nil
}

func (r *ObstacleRepo) List(ctx context.Context) (*[]Obstacle, int, error) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(r.TableName),
		Limit:     aws.Int32(1000),
	}

	result, err := r.Client.Scan(ctx, input)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to scan dictionary word: %w", err)
	}

	var obstacles []Obstacle
	err = attributevalue.UnmarshalListOfMaps(result.Items, &obstacles)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal obstacle: %w", err)
	}
	return &obstacles, http.StatusOK, nil
}

func (r *ObstacleRepo) Get(ctx context.Context, id int) (*Obstacle, int, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", id)},
		},
	}

	result, err := r.Client.GetItem(ctx, input)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query dictionary word: %w", err)
	}

	var obstacle Obstacle
	err = attributevalue.UnmarshalMap(result.Item, &obstacle)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal obstacle: %w", err)
	}
	return &obstacle, http.StatusOK, nil
}

func (r *ObstacleRepo) CreateOrUpdate(ctx context.Context, obstacle *Obstacle) (int, error) {
	update := expression.Set(expression.Name("position"), expression.Value(obstacle.Position))
	update.Set(expression.Name("type"), expression.Value(obstacle.Type))
	update.Set(expression.Name("description"), expression.Value(obstacle.Description))
	update.Set(expression.Name("danger_level"), expression.Value(obstacle.DangerLevel))
	// update.Set(expression.Name("nodes"), expression.Value(obstacle.Nodes))
	update.Set(expression.Name("way_id"), expression.Value(obstacle.WayID))
	// 一時的にコメントアウト
	// update.Set(expression.Name("nearest_distance"), expression.Value(obstacle.NearestDistance))
	// update.Set(expression.Name("no_nearby_road"), expression.Value(obstacle.NoNearbyRoad))
	update.Set(expression.Name("image_s3_key"), expression.Value(obstacle.ImageS3Key))
	update.Set(expression.Name("created_at"), expression.Value(obstacle.CreatedAt))

	expr, err := expression.NewBuilder().WithUpdate(update).Build()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to build expression: %w", err)
	}

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", obstacle.ID)},
		},
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
		UpdateExpression:          expr.Update(),
	}

	_, err = r.Client.UpdateItem(ctx, input)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to create obstacle: %w", err)
	}
	return http.StatusOK, nil
}

func (r *ObstacleRepo) Delete(ctx context.Context, id int) (int, error) {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", id)},
		},
	}

	_, err := r.Client.DeleteItem(ctx, input)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to delete obstacle: %w", err)
	}

	return http.StatusOK, nil
}
