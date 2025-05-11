package repository

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"

	"street-view/core/domain/model"
	"street-view/core/domain/repository"
	a "street-view/core/pkg/aws"
)

// DynamoDBShelterRepository はDynamoDBを使用したShelterRepositoryの実装です
type DynamoDBShelterRepository struct {
	client    *dynamodb.Client
	tableName string
}

// NewDynamoDBShelterRepository は新しいDynamoDBShelterRepositoryインスタンスを生成します
func NewDynamoDBShelterRepository(client *dynamodb.Client) repository.ShelterRepository {
	// SSMからテーブル名を取得
	tableName := a.GetDynamoDBTableName()
	if tableName == "" {
		log.Println("Warning: DynamoDB table name not found in SSM, using default")
		tableName = "shelters" // デフォルト値
	}
	
	log.Printf("Using DynamoDB table: %s", tableName)
	
	return &DynamoDBShelterRepository{
		client:    client,
		tableName: tableName,
	}
}

// DynamoDBShelter はDynamoDBに保存するためのシェルターモデルです
type DynamoDBShelter struct {
	ID     string  `dynamodbav:"id"`
	Name   string  `dynamodbav:"name"`
	Lat    float32 `dynamodbav:"lat"`
	Lng    float32 `dynamodbav:"lng"`
	Height float32 `dynamodbav:"height"`
}

// FindAll は全てのシェルターを取得します
func (r *DynamoDBShelterRepository) FindAll(ctx context.Context) ([]model.Shelter, error) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(r.tableName),
	}

	result, err := r.client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to scan shelters: %w", err)
	}

	var dbShelters []DynamoDBShelter
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &dbShelters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal shelters: %w", err)
	}

	shelters := make([]model.Shelter, len(dbShelters))
	for i, dbShelter := range dbShelters {
		shelters[i] = model.Shelter{
			ID:     dbShelter.ID,
			Name:   dbShelter.Name,
			Lat:    dbShelter.Lat,
			Lng:    dbShelter.Lng,
			Height: dbShelter.Height,
		}
	}

	return shelters, nil
}

// FindByID は指定IDのシェルターを取得します
func (r *DynamoDBShelterRepository) FindByID(ctx context.Context, id string) (*model.Shelter, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
	}

	result, err := r.client.GetItem(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to get shelter: %w", err)
	}

	if result.Item == nil {
		return nil, errors.New("shelter not found")
	}

	var dbShelter DynamoDBShelter
	if err := attributevalue.UnmarshalMap(result.Item, &dbShelter); err != nil {
		return nil, fmt.Errorf("failed to unmarshal shelter: %w", err)
	}

	shelter := model.Shelter{
		ID:     dbShelter.ID,
		Name:   dbShelter.Name,
		Lat:    dbShelter.Lat,
		Lng:    dbShelter.Lng,
		Height: dbShelter.Height,
	}

	return &shelter, nil
}

// Create は新しいシェルターを作成します
func (r *DynamoDBShelterRepository) Create(ctx context.Context, shelter model.Shelter) (*model.Shelter, error) {
	// IDが空の場合は新しいIDを生成
	if shelter.ID == "" {
		shelter.ID = uuid.New().String()
	}

	dbShelter := DynamoDBShelter{
		ID:     shelter.ID,
		Name:   shelter.Name,
		Lat:    shelter.Lat,
		Lng:    shelter.Lng,
		Height: shelter.Height,
	}

	item, err := attributevalue.MarshalMap(dbShelter)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal shelter: %w", err)
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	}

	_, err = r.client.PutItem(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to put shelter: %w", err)
	}

	return &shelter, nil
}

// Update は指定IDのシェルターを更新します
func (r *DynamoDBShelterRepository) Update(ctx context.Context, shelter model.Shelter) (*model.Shelter, error) {
	dbShelter := DynamoDBShelter{
		ID:     shelter.ID,
		Name:   shelter.Name,
		Lat:    shelter.Lat,
		Lng:    shelter.Lng,
		Height: shelter.Height,
	}

	item, err := attributevalue.MarshalMap(dbShelter)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal shelter: %w", err)
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	}

	_, err = r.client.PutItem(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to update shelter: %w", err)
	}

	return &shelter, nil
}

// Delete は指定IDのシェルターを削除します
func (r *DynamoDBShelterRepository) Delete(ctx context.Context, id string) error {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
	}

	_, err := r.client.DeleteItem(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to delete shelter: %w", err)
	}

	return nil
} 

