package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"street-view/core/handler"
	"street-view/core/infrastructure/repository"
	"street-view/core/middleware"
	"street-view/core/pkg/aws"
	"street-view/core/usecase"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

var shelterHandler *handler.ShelterHandler
var awsAuthConfig *middleware.AWSAuthConfig

func init() {
	// DynamoDBクライアントの初期化
	dynamoDBClient := aws.InitDynamoDB()

	// リポジトリ層の初期化
	shelterRepo := repository.NewDynamoDBShelterRepository(dynamoDBClient)

	// ユースケース層の初期化
	shelterUseCase := usecase.NewShelterUseCase(shelterRepo)

	// ハンドラー層の初期化
	shelterHandler = handler.NewShelterHandler(shelterUseCase)

	// 環境変数のログ出力（デバッグ用）
	tableName := os.Getenv("DYNAMODB_TABLE_NAME")
	log.Printf("Using DynamoDB table: %s", tableName)

	// AWS認証設定の初期化
	userPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	appClientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	
	if userPoolID != "" && appClientID != "" {
		awsAuthConfig = middleware.NewAWSAuthConfig(userPoolID, appClientID)
		log.Printf("AWS Auth initialized with User Pool ID: %s", userPoolID)
	} else {
		log.Println("AWS Auth disabled: missing configuration")
	}
}

// Router はAPIルートを定義するための構造体
type Router struct {
	routes      map[string]map[string]http.HandlerFunc
	middlewares []func(http.Handler) http.Handler
}

// NewRouter は新しいルーターを作成します
func NewRouter() *Router {
	return &Router{
		routes:      make(map[string]map[string]http.HandlerFunc),
		middlewares: []func(http.Handler) http.Handler{},
	}
}

// Use はミドルウェアを追加します
func (r *Router) Use(middleware func(http.Handler) http.Handler) {
	r.middlewares = append(r.middlewares, middleware)
}

// Handle はルートとハンドラーを登録します
func (r *Router) Handle(method, path string, handler http.HandlerFunc) {
	if r.routes[path] == nil {
		r.routes[path] = make(map[string]http.HandlerFunc)
	}
	r.routes[path][method] = handler
}

// Match はリクエストに一致するハンドラーを探します
func (r *Router) Match(method, path string) (http.HandlerFunc, map[string]string, bool) {
	// 完全一致のチェック
	if handlers, ok := r.routes[path]; ok {
		if handler, ok := handlers[method]; ok {
			return handler, nil, true
		}
	}

	// パスパラメータを含むルートのチェック
	params := make(map[string]string)
	for routePath, handlers := range r.routes {
		if handler, ok := handlers[method]; ok {
			// パスパラメータを含むルートかチェック
			if strings.Contains(routePath, "{") && strings.Contains(routePath, "}") {
				matched, extractedParams := matchPathWithParams(routePath, path)
				if matched {
					for k, v := range extractedParams {
						params[k] = v
					}
					return handler, params, true
				}
			}
		}
	}

	return nil, nil, false
}

// matchPathWithParams はパスパラメータを含むルートとリクエストパスをマッチングします
func matchPathWithParams(routePath, requestPath string) (bool, map[string]string) {
	routeParts := strings.Split(routePath, "/")
	requestParts := strings.Split(requestPath, "/")

	if len(routeParts) != len(requestParts) {
		return false, nil
	}

	params := make(map[string]string)
	for i, routePart := range routeParts {
		if strings.HasPrefix(routePart, "{") && strings.HasSuffix(routePart, "}") {
			// パラメータ名を抽出
			paramName := routePart[1 : len(routePart)-1]
			params[paramName] = requestParts[i]
		} else if routePart != requestParts[i] {
			return false, nil
		}
	}

	return true, params
}

func handleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	log.Printf("Processing request: %s %s", request.HTTPMethod, request.Path)

	// ルーターの初期化（ミドルウェア適用済み）
	router := initRouter()

	// ルートのマッチングと処理
	w := NewMockResponseWriter()
	r, err := createHTTPRequest(ctx, request)
	if err != nil {
		log.Printf("Error creating HTTP request: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       fmt.Sprintf(`{"message":"Internal server error: %s"}`, err.Error()),
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
		}, nil
	}

	router.ServeHTTP(w, r)

	// レスポンスの構築
	headers := mergeHeaders(w.Headers)
	return events.APIGatewayProxyResponse{
		StatusCode: w.StatusCode,
		Body:       w.Body.String(),
		Headers:    headers,
	}, nil
}

// createHTTPRequest はAPIGatewayProxyRequestからhttp.Requestを作成します
func createHTTPRequest(ctx context.Context, request events.APIGatewayProxyRequest) (*http.Request, error) {
	// リクエストボディの作成
	var body *bytes.Buffer
	if request.Body != "" {
		body = bytes.NewBufferString(request.Body)
	} else {
		body = bytes.NewBufferString("")
	}

	// HTTPリクエストの作成
	r, err := http.NewRequestWithContext(ctx, request.HTTPMethod, request.Path, body)
	if err != nil {
		return nil, err
	}

	// ヘッダーの設定
	for k, v := range request.Headers {
		r.Header.Set(k, v)
	}

	// Content-Typeの設定
	if r.Header.Get("Content-Type") == "" {
		r.Header.Set("Content-Type", "application/json")
	}

	// クエリパラメータの設定
	q := r.URL.Query()
	for k, v := range request.QueryStringParameters {
		q.Add(k, v)
	}
	r.URL.RawQuery = q.Encode()

	// パスパラメータをコンテキストに追加
	params := make(map[string]string)
	for k, v := range request.PathParameters {
		params[k] = v
	}
	for k, v := range request.QueryStringParameters {
		params[k] = v
	}
	for k, v := range params {
		r = r.WithContext(context.WithValue(r.Context(), k, v))
	}

	// API Gatewayの認証情報をコンテキストに追加
	if request.RequestContext.Authorizer != nil {
		if claims, ok := request.RequestContext.Authorizer["claims"].(map[string]interface{}); ok {
			if sub, ok := claims["sub"].(string); ok {
				r = r.WithContext(context.WithValue(r.Context(), "userID", sub))
			}
		}
	}

	return r, nil
}

// mergeHeaders はレスポンスヘッダーをマージします
func mergeHeaders(headers http.Header) map[string]string {
	result := make(map[string]string)
	for k, v := range headers {
		if len(v) > 0 {
			result[k] = v[0]
		}
	}
	// Content-Typeが設定されていない場合はデフォルト値を設定
	if _, ok := result["Content-Type"]; !ok {
		result["Content-Type"] = "application/json"
	}
	return result
}

func main() {
	lambda.Start(handleRequest)
}

// MockResponseWriter はhttp.ResponseWriterのモック実装です
type MockResponseWriter struct {
	StatusCode int
	Body       *bytes.Buffer
	Headers    http.Header
}

func NewMockResponseWriter() *MockResponseWriter {
	return &MockResponseWriter{
		StatusCode: http.StatusOK,
		Body:       new(bytes.Buffer),
		Headers:    make(http.Header),
	}
}

func (m *MockResponseWriter) Header() http.Header {
	return m.Headers
}

func (m *MockResponseWriter) Write(b []byte) (int, error) {
	return m.Body.Write(b)
}

func (m *MockResponseWriter) WriteHeader(statusCode int) {
	m.StatusCode = statusCode
}

// MockReadCloser はio.ReadCloserのモック実装です
type MockReadCloser struct {
	*strings.Reader
}

func NewMockReadCloser(s string) *MockReadCloser {
	return &MockReadCloser{strings.NewReader(s)}
}

func (m *MockReadCloser) Close() error {
	return nil
}

// registerRoutes はルーターにAPIルートを登録します
func registerRoutes(router *Router) {
	router.Handle("GET", "/shelters", shelterHandler.GetAllShelters)
	router.Handle("POST", "/shelters", shelterHandler.CreateShelter)
	router.Handle("GET", "/shelters/{id}", shelterHandler.GetShelter)
	router.Handle("PUT", "/shelters/{id}", shelterHandler.UpdateShelter)
	router.Handle("DELETE", "/shelters/{id}", shelterHandler.DeleteShelter)
}

// ServeHTTP はhttp.Handlerインターフェースを実装します
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	handler, params, found := r.Match(req.Method, req.URL.Path)
	if !found {
		http.Error(w, `{"message":"Not Found"}`, http.StatusNotFound)
		return
	}
	
	// パスパラメータをリクエストコンテキストに追加
	for k, v := range params {
		req = req.WithContext(context.WithValue(req.Context(), k, v))
	}
	
	// ハンドラーをミドルウェアでラップ
	var next http.Handler = http.HandlerFunc(handler)
	
	// ミドルウェアを逆順に適用（最後に追加されたものが最初に実行される）
	for i := len(r.middlewares) - 1; i >= 0; i-- {
		next = r.middlewares[i](next)
	}
	
	next.ServeHTTP(w, req)
}

// initRouter はルーターの初期化と認証ミドルウェアの適用を行います
func initRouter() *Router {
	router := NewRouter()
	
	// 認証ミドルウェアを適用（設定がある場合のみ）
	if awsAuthConfig != nil {
		router.Use(middleware.AWSAuthMiddleware(awsAuthConfig))
	}
	
	// ルートの登録
	registerRoutes(router)
	
	return router
} 