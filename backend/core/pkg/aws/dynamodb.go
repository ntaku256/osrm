package aws

import (
	"context"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

// InitDynamoDB はDynamoDBクライアントを初期化します
func InitDynamoDB() *dynamodb.Client {
	// AWS SDKの設定を読み込む
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("AWS設定の読み込みエラー: %v", err)
	}

	// DynamoDBクライアントを作成
	client := dynamodb.NewFromConfig(cfg)

	// 開発環境の場合、テーブルが存在するか確認し、なければ作成
	if os.Getenv("APP_ENV") == "development" {
		ensureShelterTableExists(client)
	}

	return client
}

// ensureShelterTableExists はシェルターテーブルが存在することを確認し、なければ作成します
func ensureShelterTableExists(client *dynamodb.Client) {
	// テーブルが存在するか確認
	_, err := client.DescribeTable(context.TODO(), &dynamodb.DescribeTableInput{
		TableName: aws.String("shelters"),
	})

	if err == nil {
		// テーブルが存在する場合は何もしない
		log.Println("シェルターテーブルは既に存在します")
		return
	}

	// テーブルが存在しない場合は作成
	_, err = client.CreateTable(context.TODO(), &dynamodb.CreateTableInput{
		TableName: aws.String("shelters"),
		AttributeDefinitions: []types.AttributeDefinition{
			{
				AttributeName: aws.String("id"),
				AttributeType: types.ScalarAttributeTypeS,
			},
		},
		KeySchema: []types.KeySchemaElement{
			{
				AttributeName: aws.String("id"),
				KeyType:       types.KeyTypeHash,
			},
		},
		BillingMode: types.BillingModePayPerRequest,
	})

	if err != nil {
		log.Fatalf("シェルターテーブルの作成エラー: %v", err)
	}

	log.Println("シェルターテーブルを作成しました")
}

// GetDynamoDBTableName はDynamoDBテーブル名を環境変数またはSSMから取得します
func GetDynamoDBTableName() string {
	// 直接環境変数から取得
	tableName := os.Getenv("DYNAMODB_TABLE_NAME")
	if tableName != "" {
		return tableName
	}

	// SSMから取得
	ssmPath := os.Getenv("SSM_PATH_DYNAMODB_TABLE_NAME")
	if ssmPath != "" {
		client := InitSSM()
		result, err := client.GetParameter(context.TODO(), &ssm.GetParameterInput{
			Name:           aws.String(ssmPath),
			WithDecryption: aws.Bool(true),
		})
		if err == nil && result.Parameter != nil && result.Parameter.Value != nil {
			return *result.Parameter.Value
		}
		log.Printf("SSMからテーブル名の取得に失敗: %v", err)
	}

	return ""
} 
