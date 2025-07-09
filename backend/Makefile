.PHONY: \
  build \

format:
	gofmt -w .

lint:
	go vet ./...

vendor:
	go mod vendor

sam-build:
	sam build --use-container --cached --parallel

# プロジェクトをデプロイ用にビルド
build:
	set GOWORK=off \
	go mod vendor && \
	sam build --use-container --cached --parallel

# プロジェクトをデプロイ用にビルド
build-for-github-actions:
	GOWORK=off \
	go mod vendor && \
	sam build --use-container --cached --parallel --parameter-overrides Architectures=x86_64

# dev環境にデプロイ
deploy-dev:
	make build && \
	sam deploy --capabilities CAPABILITY_NAMED_IAM --guided

# dev環境にデプロイ（差分確認なし）
deploy-dev-y:
	make build && \
	sam deploy --capabilities CAPABILITY_NAMED_IAM --no-confirm-changeset

# prd環境にデプロイ
deploy-prd:
	make build && \
	sam deploy --capabilities CAPABILITY_NAMED_IAM --config-env prd

# ローカル環境でapiを起動する（dockerのインストールが必要）
start:
	sam local start-api

ARTIFACTS_DIR=artifacts
build-ObstacleFunction:
	mkdir -p $(ARTIFACTS_DIR)
	go build -tags netgo -o bootstrap ./handler/obstacle
	cp bootstrap $(ARTIFACTS_DIR)

build-ShelterFunction:
	mkdir -p $(ARTIFACTS_DIR)
	go build -tags netgo -o bootstrap ./handler/shelter
	cp bootstrap $(ARTIFACTS_DIR)

build-UserFunction:
	mkdir -p $(ARTIFACTS_DIR)
	go build -tags netgo -o bootstrap ./handler/user
	cp bootstrap $(ARTIFACTS_DIR)

build-WalkedRouteFunction:
	mkdir -p $(ARTIFACTS_DIR)
	GOARCH=arm64 GOOS=linux go build -tags netgo -o bootstrap ./handler/walked_route
	cp bootstrap $(ARTIFACTS_DIR)

sam-build-ObstacleFunction:
	sam build --use-container --cached --parallel ObstacleFunction

sam-build-ShelterFunction:
	sam build --use-container --cached --parallel ShelterFunction

sam-build-UserFunction:
	sam build --use-container --cached --parallel UserFunction

sam-build-WalkedRouteFunction:
	sam build --use-container --cached --parallel WalkedRouteFunction
