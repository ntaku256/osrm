package aws

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

var ssmClient *ssm.Client
var paramCache = make(map[string]string)

// InitSSM はSSMクライアントを初期化します
func InitSSM() *ssm.Client {
	if ssmClient != nil {
		return ssmClient
	}

	// AWS SDKの設定を読み込む
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("AWS設定の読み込みエラー: %v", err)
	}

	// SSMクライアントを作成
	ssmClient = ssm.NewFromConfig(cfg)
	return ssmClient
}

// GetParameter はSSMパラメータストアから値を取得します
func GetParameter(paramName string) string {
	// 環境変数から直接取得を試みる
	envValue := os.Getenv(paramName)
	if envValue != "" {
		return envValue
	}

	// SSM_PATH_ プレフィックスがある場合はSSMから取得
	if strings.HasPrefix(paramName, "SSM_PATH_") {
		ssmPath := os.Getenv(paramName)
		if ssmPath == "" {
			log.Printf("Warning: SSM path environment variable %s is not set", paramName)
			return ""
		}

		// キャッシュをチェック
		if cachedValue, ok := paramCache[ssmPath]; ok {
			return cachedValue
		}

		// SSMから取得
		client := InitSSM()
		result, err := client.GetParameter(context.TODO(), &ssm.GetParameterInput{
			Name:           aws.String(ssmPath),
			WithDecryption: aws.Bool(true),
		})
		if err != nil {
			log.Printf("Error getting parameter %s: %v", ssmPath, err)
			return ""
		}

		// キャッシュに保存
		paramValue := *result.Parameter.Value
		paramCache[ssmPath] = paramValue
		return paramValue
	}

	return ""
}

// GetAWSRegion はAWSリージョンをSSMから取得します
func GetAWSRegion() string {
	// 直接環境変数から取得を試みる
	region := os.Getenv("AWS_REGION")
	if region != "" {
		return region
	}

	// SSMから取得
	return GetParameter("SSM_PATH_AWS_REGION")
} 