# シェルターAPI

クリーンアーキテクチャに基づいたバックエンドAPIサーバー。AWS DynamoDB を使用したデータストレージと AWS Lambda + API Gateway によるサーバーレスアーキテクチャを採用しています。

## アーキテクチャ

このプロジェクトはクリーンアーキテクチャの原則に従って構築されています：

- **ドメイン層**: ビジネスロジックとエンティティを含む中核部分
- **ユースケース層**: アプリケーションの特定のユースケースを実装
- **インフラストラクチャ層**: DynamoDB やその他の外部サービスとの連携
- **プレゼンテーション層**: REST API (API Gateway + Lambda)

## プロジェクト構造

```
backend/
├── core/
│   ├── cmd/                  # メインアプリケーションのエントリーポイント
│   │   ├── main.go           # ローカル開発用サーバー
│   │   └── lambda/           # AWS Lambda ハンドラー
│   ├── domain/               # ドメインモデルとリポジトリインターフェイス
│   ├── handler/              # HTTPハンドラー
│   ├── infrastructure/       # リポジトリの実装
│   │   └── repository/       # DynamoDB リポジトリ
│   ├── middleware/           # HTTPミドルウェア
│   ├── pkg/                  # ユーティリティパッケージ
│   │   ├── aws/              # AWS関連の初期化コード
│   │   ├── oapi/             # OpenAPIから生成されたコード
│   │   └── validation/       # バリデーションルール
│   └── usecase/              # ユースケース
├── apigateway.yml            # API Gateway 定義
├── openapi.yml               # OpenAPI 仕様
└── template.yml              # AWS SAM テンプレート
```

## セットアップ

1. 必要条件:
   - Go 1.18以上
   - AWS CLI
   - AWS SAM CLI

2. 環境変数の設定:
   - `.env.example`を`.env`にコピーして必要な変数を設定

3. ローカル開発:
   ```
   make build
   ./bin/server
   ```

4. AWS へのデプロイ:
   ```
   # 開発環境
   make deploy-dev
   
   # 本番環境
   make deploy-prd
   ```

## API エンドポイント

APIは以下のエンドポイントを提供します:

- `GET /shelters` - 全てのシェルターを取得
- `GET /shelters/{id}` - 指定IDのシェルターを取得
- `POST /shelters` - 新しいシェルターを作成
- `PUT /shelters/{id}` - 指定IDのシェルターを更新
- `DELETE /shelters/{id}` - 指定IDのシェルターを削除

## 認証

認証が必要なエンドポイントでは、リクエストヘッダーに以下を含める必要があります:
```
Authorization: Bearer <firebase-id-token>
``` 