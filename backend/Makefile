.PHONY: \
  build \
  build-lambda run clean generate

SERVICES = $(shell go list -f '{{.Dir}}' ./...)
SRCS = $(shell git ls-files '*.go')

build:
	go build -o bin/server ./core/cmd

build-lambda:
	GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o bootstrap ./core/cmd/lambda
	zip -j function.zip bootstrap

run:
	go run ./core/cmd/main.go

clean:
	rm -rf bin/ bootstrap function.zip

generate:
	go run github.com/deepmap/oapi-codegen/v2/cmd/oapi-codegen@v2.2.0 -config ./config.yaml ./openapi.yml

# dev環境にデプロイ
deploy-dev:
	make build-lambda && \
	sam deploy --stack-name shelter-api-dev \
		--template-file template.yml \
		--capabilities CAPABILITY_NAMED_IAM \
		--parameter-overrides ENV=dev

# prd環境にデプロイ
deploy-prd:
	make build-lambda && \
	sam deploy --stack-name shelter-api-prd \
		--template-file template.yml \
		--capabilities CAPABILITY_NAMED_IAM \
		--parameter-overrides ENV=prd
