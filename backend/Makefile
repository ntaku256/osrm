.PHONY: \
  build \
  fmtcheck \
	fmtcheck-witherror \

SERVICES = $(shell go list -f '{{.Dir}}' ./...)
SRCS = $(shell git ls-files '*.go')

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

golangci-lint:
	golangci-lint run -e 'pp.*|pretty.*' --timeout=1h

fmtcheck:
	@ $(foreach file,$(SRCS),gofmt -s -l $(file);)

fmtcheck-witherror:
	make -s fmtcheck | while read o; do if test $o -n; then make -s fmtcheck && exit 1; fi; done

build-ObstacleFunction:
	go build -tags netgo -o bootstrap ./handler/obstacle
	cp bootstrap $(ARTIFACTS_DIR)
