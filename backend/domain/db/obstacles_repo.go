package db

import (
	"fmt"
	"net/http"

	"webhook/shared/util"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/aws/aws-sdk-go/service/dynamodb/expression"
)

type ObstacleRepo struct {
	TableName   string
}

func NewObstacleRepo() *ObstacleRepo {
	obstacleRepo := util.GetSetting().ObstacleTable
	return &ObstacleRepo{
		TableName:   obstacleRepo.TableName,
	}
}

func (r *ObstacleRepo) List() (*[]Obstacle, int, error) {
	sess := session.Must(session.NewSession())
	svc := dynamodb.New(sess)

	input := &dynamodb.ScanInput{
		TableName: aws.String(r.TableName),
		Limit:     aws.Int64(1000),
	}

	result, err := svc.Scan(input)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to scan dictionary word: %w", err)
	}

	var obstacles []Obstacle
	err = dynamodbattribute.UnmarshalListOfMaps(result.Items, &obstacles)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal obstacle: %w", err)
	}
	return &obstacles, http.StatusOK, nil
}

func (r *ObstacleRepo) Get(id int) (*Obstacle, int, error) {
	sess := session.Must(session.NewSession())
	svc := dynamodb.New(sess)

	input := &dynamodb.GetItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]*dynamodb.AttributeValue{
			"id": {
				N: aws.String(fmt.Sprintf("%d", id)),
			},
		},
	}

	result, err := svc.GetItem(input)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query dictionary word: %w", err)
	}

	var obstacle Obstacle
	err = dynamodbattribute.UnmarshalMap(result.Item, &obstacle)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to unmarshal obstacle: %w", err)
	}
	return &obstacle, http.StatusOK, nil
}

func (r *ObstacleRepo) CreateOrUpdate(obstacle *Obstacle) (int, error) {
	sess := session.Must(session.NewSession())
	svc := dynamodb.New(sess)

	update := expression.Set(expression.Name("position"), expression.Value(obstacle.Position))
	update.Set(expression.Name("type"), expression.Value(obstacle.Type))
	update.Set(expression.Name("description"), expression.Value(obstacle.Description))
	update.Set(expression.Name("danger_level"), expression.Value(obstacle.DangerLevel))
	update.Set(expression.Name("created_at"), expression.Value(obstacle.CreatedAt))

	expr, err := expression.NewBuilder().WithUpdate(update).Build()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to build expression: %w", err)
	}

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]*dynamodb.AttributeValue{
			"id": {
				N: aws.String(fmt.Sprintf("%d", obstacle.ID)),
			},
		},
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
		UpdateExpression:          expr.Update(),
	}

	_, err = svc.UpdateItem(input)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to create obstacle: %w", err)
	}
	return http.StatusOK, nil
}

func (r *ObstacleRepo) Delete(id int) (int, error) {
	sess := session.Must(session.NewSession())
	svc := dynamodb.New(sess)

	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(r.TableName),
		Key: map[string]*dynamodb.AttributeValue{
			"id": {
				N: aws.String(fmt.Sprintf("%d", id)),
			},
		},
	}

	_, err := svc.DeleteItem(input)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("failed to delete obstacle: %w", err)
	}

	return http.StatusOK, nil
}
