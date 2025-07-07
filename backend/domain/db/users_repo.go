package db

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type UserRepo struct {
	dynamoClient *dynamodb.Client
	tableName    string
}

func NewUserRepo(ctx context.Context) (*UserRepo, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}

	client := dynamodb.NewFromConfig(cfg)
	tableName := os.Getenv("USER_TABLE_NAME")

	return &UserRepo{
		dynamoClient: client,
		tableName:    tableName,
	}, nil
}

func (r *UserRepo) CreateOrUpdate(ctx context.Context, user *User) (int, error) {
	item, err := attributevalue.MarshalMap(user)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	_, err = r.dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	if err != nil {
		return http.StatusInternalServerError, err
	}

	return http.StatusOK, nil
}

func (r *UserRepo) GetByFirebaseUID(ctx context.Context, firebaseUID string) (*User, int, error) {
	key := map[string]types.AttributeValue{
		"firebase_uid": &types.AttributeValueMemberS{
			Value: firebaseUID,
		},
	}

	result, err := r.dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key:       key,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	if result.Item == nil {
		return nil, http.StatusNotFound, nil
	}

	var user User
	err = attributevalue.UnmarshalMap(result.Item, &user)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return &user, http.StatusOK, nil
}

func (r *UserRepo) Delete(ctx context.Context, firebaseUID string) (int, error) {
	key := map[string]types.AttributeValue{
		"firebase_uid": &types.AttributeValueMemberS{
			Value: firebaseUID,
		},
	}

	_, err := r.dynamoClient.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key:       key,
	})
	if err != nil {
		return http.StatusInternalServerError, err
	}

	return http.StatusOK, nil
}

// SoftDeleteFirebaseData marks user as Firebase deleted without removing user data
func (r *UserRepo) SoftDeleteFirebaseData(ctx context.Context, firebaseUID string) (int, error) {
	// First, get the existing user
	existingUser, statusCode, err := r.GetByFirebaseUID(ctx, firebaseUID)
	if err != nil {
		return statusCode, err
	}
	if existingUser == nil {
		return http.StatusNotFound, nil
	}

	// Update the user with Firebase deletion marker
	existingUser.IsFirebaseDeleted = true
	existingUser.UpdatedAt = time.Now().Format(time.RFC3339)

	return r.CreateOrUpdate(ctx, existingUser)
} 