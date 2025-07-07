package auth

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ssm"
	"google.golang.org/api/option"
)

var firebaseApp *firebase.App

// getFirebaseServiceAccountKey gets Firebase service account key from Parameter Store
func getFirebaseServiceAccountKey(ctx context.Context) (string, error) {
	env := os.Getenv("ENV")
	if env == "" {
		env = "dev"
	}

	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "ap-northeast-1" // デフォルトリージョン
	}

	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		return "", err
	}

	ssmSvc := ssm.New(sess)
	paramName := fmt.Sprintf("/%s/firebase-service-account-key", env)

	input := &ssm.GetParameterInput{
		Name:           aws.String(paramName),
		WithDecryption: aws.Bool(true),
	}

	result, err := ssmSvc.GetParameterWithContext(ctx, input)
	if err != nil {
		return "", err
	}

	return *result.Parameter.Value, nil
}

// InitFirebase initializes Firebase app with service account
func InitFirebase(ctx context.Context) error {
	// Firebase service account key from Parameter Store
	serviceAccountKey, err := getFirebaseServiceAccountKey(ctx)
	if err != nil {
		return fmt.Errorf("failed to get Firebase service account key from Parameter Store: %w", err)
	}

	// Decode base64 service account key
	decodedKey, err := base64.StdEncoding.DecodeString(serviceAccountKey)
	if err != nil {
		return err
	}

	opt := option.WithCredentialsJSON(decodedKey)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return err
	}

	firebaseApp = app
	return nil
}

// VerifyIDToken verifies Firebase ID token and returns the decoded token
func VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	if firebaseApp == nil {
		if err := InitFirebase(ctx); err != nil {
			return nil, err
		}
	}

	client, err := firebaseApp.Auth(ctx)
	if err != nil {
		return nil, err
	}

	token, err := client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, err
	}

	return token, nil
}

// ExtractTokenFromAuthHeader extracts the ID token from Authorization header
func ExtractTokenFromAuthHeader(authHeader string) (string, error) {
	if authHeader == "" {
		return "", errors.New("authorization header is empty")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", errors.New("invalid authorization header format")
	}

	return parts[1], nil
}

// AuthResponse represents authentication response
type AuthResponse struct {
	StatusCode int                 `json:"status_code"`
	Message    string              `json:"message"`
	Errors     map[string][]string `json:"errors,omitempty"`
}

// ValidateFirebaseToken validates Firebase token from request headers
func ValidateFirebaseToken(ctx context.Context, authHeader string) (*auth.Token, int, error) {
	token, err := ExtractTokenFromAuthHeader(authHeader)
	if err != nil {
		return nil, http.StatusUnauthorized, err
	}

	decodedToken, err := VerifyIDToken(ctx, token)
	if err != nil {
		return nil, http.StatusUnauthorized, err
	}

	return decodedToken, http.StatusOK, nil
} 