# yamablog justfile

# レシピ一覧を表示
default:
    @just --list

# TypeScript型生成（スキーマ変更時のみ実行）
gen-types:
    pnpm dlx json-schema-to-typescript schema/manifest.schema.json -o editor/src/types/manifest.ts
    pnpm dlx json-schema-to-typescript schema/article.schema.json -o editor/src/types/article.ts
    pnpm dlx json-schema-to-typescript schema/files.schema.json -o editor/src/types/files.ts

# ブログ公開用JSバンドルビルド（blog/dist/ に出力）
blog-build:
    cd blog && pnpm run build

# CLIビルド
cli-build:
    cd cli && cargo build --release

# エディタビルド
editor-build:
    cd editor && pnpm run build

# 全ビルド
build: blog-build cli-build editor-build

# CLIテスト
cli-test:
    cd cli && cargo test

# エディタ dev server を起動（Vite）
editor-dev:
    cd editor && pnpm run dev

# JSONからHTMLを生成してローカルに出力
convert:
    cd cli && cargo run -- build --data-dir ../data --output-dir /tmp/yamablog-preview

# convert 後にnginxで配信してブラウザ確認（Ctrl+Cで停止）
preview: convert
    @echo "Preview: http://localhost:8080"
    docker run --rm -p 8080:80 -v /tmp/yamablog-preview:/usr/share/nginx/html:ro nginx:alpine

# HTMLを生成してS3互換ストレージにデプロイ
# 必要な環境変数: R2_ENDPOINT_URL, R2_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
deploy:
    cd cli && cargo run --release -- build --data-dir ../data --output-dir /tmp/yamablog-dist
    aws s3 sync /tmp/yamablog-dist s3://$R2_BUCKET \
        --endpoint-url $R2_ENDPOINT_URL \
        --delete \
        --exclude "assets/*" \
        --cache-control "no-cache"
    aws s3 sync /tmp/yamablog-dist s3://$R2_BUCKET \
        --endpoint-url $R2_ENDPOINT_URL \
        --exclude "*" --include "assets/*" \
        --cache-control "max-age=31536000, immutable"
