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

type ShelterRepo struct {
	TableName string
	Client    *dynamodb.Client
}

func NewShelterRepo(ctx context.Context) (*ShelterRepo, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	shelterRepo := util.GetSetting().ShelterTable
	return &ShelterRepo{
		TableName: shelterRepo.TableName,
		Client:    dynamodb.NewFromConfig(cfg),
	}, nil
}

func (r *ShelterRepo) List(ctx context.Context) (*[]Shelter, int, error) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(r.TableName),
		Limit:     aws.Int32(1000),
	}

	result, err := r.Client.Scan(ctx, input)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to scan shelter: %w", err)
	}

	var shelters []Shelter
	err = attributevalue.UnmarshalListOfMaps(result.Items, &shelters)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal shelter: %w", err)
	}
	return &shelters, http.StatusOK, nil
}

func (r *ShelterRepo) Get(ctx context.Context, id int) (*Shelter, int, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", id)},
		},
	}

	result, err := r.Client.GetItem(ctx, input)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query shelter: %w", err)
	}

	var shelter Shelter
	err = attributevalue.UnmarshalMap(result.Item, &shelter)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal shelter: %w", err)
	}
	return &shelter, http.StatusOK, nil
}

func (r *ShelterRepo) CreateOrUpdate(ctx context.Context, shelter *Shelter) (int, error) {
	update := expression.Set(expression.Name("name"), expression.Value(shelter.Name))
	update.Set(expression.Name("lat"), expression.Value(shelter.Lat))
	update.Set(expression.Name("lon"), expression.Value(shelter.Lon))
	update.Set(expression.Name("address"), expression.Value(shelter.Address))
	update.Set(expression.Name("elevation"), expression.Value(shelter.Elevation))
	update.Set(expression.Name("tsunami_safety_level"), expression.Value(shelter.TsunamiSafetyLevel))
	update.Set(expression.Name("created_at"), expression.Value(shelter.CreatedAt))

	expr, err := expression.NewBuilder().WithUpdate(update).Build()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to build expression: %w", err)
	}

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", shelter.ID)},
		},
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
		UpdateExpression:          expr.Update(),
	}

	_, err = r.Client.UpdateItem(ctx, input)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to create shelter: %w", err)
	}
	return http.StatusOK, nil
}

func (r *ShelterRepo) Delete(ctx context.Context, id int) (int, error) {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", id)},
		},
	}

	_, err := r.Client.DeleteItem(ctx, input)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to delete shelter: %w", err)
	}

	return http.StatusOK, nil
} 