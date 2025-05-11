package middleware

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
)

// contextKey は文字列の代わりに使用する型です
type contextKey string

// コンテキストキーの定義
const (
	userInfoKey contextKey = "userInfo"
)

// AWSAuthConfig は認証設定を保持します
type AWSAuthConfig struct {
	UserPoolID       string
	AppClientID      string
	RequireAuthPaths map[string][]string // メソッド別の認証が必要なパスのマップ
}

// NewAWSAuthConfig は新しい認証設定を作成します
func NewAWSAuthConfig(userPoolID, appClientID string) *AWSAuthConfig {
	return &AWSAuthConfig{
		UserPoolID:  userPoolID,
		AppClientID: appClientID,
		// デフォルトで認証が必要なパスをメソッド別に定義
		RequireAuthPaths: map[string][]string{
			http.MethodPost:   {"/shelters"},           // POSTは作成のみ
			http.MethodPut:    {"/shelters/"},          // PUTは更新
			http.MethodDelete: {"/shelters/"},          // DELETEは削除
			// GETメソッドは認証不要
		},
	}
}

// AWSAuthMiddleware はAWS Cognitoを使用した認証ミドルウェアです
func AWSAuthMiddleware(config *AWSAuthConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 認証が必要かどうかを判断
			needsAuth := false
			
			// メソッド別のパスリストを取得
			if paths, ok := config.RequireAuthPaths[r.Method]; ok {
				for _, path := range paths {
					// 完全一致のパス
					if path == r.URL.Path {
						needsAuth = true
						break
					}
					
					// プレフィックスマッチ（IDを含むパス）
					if strings.HasSuffix(path, "/") && strings.HasPrefix(r.URL.Path, path) {
						needsAuth = true
						break
					}
				}
			}
			
			// 認証が不要な場合は次のハンドラーへ
			if !needsAuth {
				next.ServeHTTP(w, r)
				return
			}
			
			// Authorizationヘッダーを取得
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"message":"Authorization header is required"}`, http.StatusUnauthorized)
				return
			}
			
			// Bearer トークンを抽出
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, `{"message":"Invalid authorization format"}`, http.StatusUnauthorized)
				return
			}
			
			token := parts[1]
			
			// トークンを検証
			userInfo, err := validateToken(r.Context(), token, config)
			if err != nil {
				log.Printf("Token validation error: %v", err)
				http.Error(w, `{"message":"Invalid or expired token"}`, http.StatusUnauthorized)
				return
			}
			
			// ユーザー情報をコンテキストに追加
			ctx := context.WithValue(r.Context(), userInfoKey, userInfo)
			
			// 認証済みリクエストを次のハンドラーへ
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserInfo はCognitoから取得したユーザー情報を保持します
type UserInfo struct {
	Username string
	Email    string
	Groups   []string
}

// validateToken はJWTトークンを検証し、ユーザー情報を返します
func validateToken(ctx context.Context, token string, config *AWSAuthConfig) (*UserInfo, error) {
	// AWS SDKの設定を読み込む
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	
	// Cognito クライアントを作成
	cognitoClient := cognitoidentityprovider.NewFromConfig(cfg)
	
	// GetUserリクエストを作成
	input := &cognitoidentityprovider.GetUserInput{
		AccessToken: aws.String(token),
	}
	
	// ユーザー情報を取得
	result, err := cognitoClient.GetUser(ctx, input)
	if err != nil {
		return nil, err
	}
	
	// ユーザー情報を構築
	userInfo := &UserInfo{
		Username: *result.Username,
		Groups:   []string{},
	}
	
	// ユーザー属性から情報を抽出
	for _, attr := range result.UserAttributes {
		if attr.Name != nil && *attr.Name == "email" && attr.Value != nil {
			userInfo.Email = *attr.Value
		}
	}
	
	// グループ情報を取得（オプション）
	if config.UserPoolID != "" {
		groupsInput := &cognitoidentityprovider.AdminListGroupsForUserInput{
			Username:   result.Username,
			UserPoolId: aws.String(config.UserPoolID),
		}
		
		groupsResult, err := cognitoClient.AdminListGroupsForUser(ctx, groupsInput)
		if err == nil && groupsResult.Groups != nil {
			for _, group := range groupsResult.Groups {
				if group.GroupName != nil {
					userInfo.Groups = append(userInfo.Groups, *group.GroupName)
				}
			}
		}
	}
	
	return userInfo, nil
}

// IsAdmin はユーザーが管理者グループに属しているかを確認します
func IsAdmin(ctx context.Context) bool {
	userInfo, ok := ctx.Value(userInfoKey).(*UserInfo)
	if !ok {
		return false
	}
	
	for _, group := range userInfo.Groups {
		if group == "admin" {
			return true
		}
	}
	
	return false
}

// RequireAdmin は管理者権限を要求するミドルウェアです
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !IsAdmin(r.Context()) {
			http.Error(w, `{"message":"Admin privileges required"}`, http.StatusForbidden)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

// GetUserFromContext はコンテキストからユーザー情報を取得します
func GetUserFromContext(ctx context.Context) (*UserInfo, error) {
	userInfo, ok := ctx.Value(userInfoKey).(*UserInfo)
	if !ok {
		return nil, errors.New("user info not found in context")
	}
	
	return userInfo, nil
} 