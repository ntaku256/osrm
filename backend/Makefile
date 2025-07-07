.PHONY: \
  build \

format:
	gofmt -w .

lint:
	go vet ./...

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

build-ObstacleFunction:
	go build -tags netgo -o bootstrap ./handler/obstacle
	cp bootstrap $(ARTIFACTS_DIR)

build-ShelterFunction:
	go build -tags netgo -o bootstrap ./handler/shelter
	cp bootstrap $(ARTIFACTS_DIR)
