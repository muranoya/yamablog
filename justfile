# yamablog justfile

set dotenv-filename := "deploy.env"
set dotenv-load

# レシピ一覧の表示
default:
    @just --list

# ファイル変更を監視して自動再ビルド + nginx プレビュー（Ctrl+C で全停止）
watch:
    #!/usr/bin/env bash
    set -euo pipefail
    REPO_ROOT="{{justfile_directory()}}"
    echo "==> 初回ビルド中..."
    rm -rf "$REPO_ROOT/preview" && mkdir -p "$REPO_ROOT/preview"
    cd "$REPO_ROOT/blog" && pnpm run build
    cd "$REPO_ROOT/cli" && cargo run -- build \
        --db "$REPO_ROOT/data/blog.sqlite3" \
        --gpx-dir "$REPO_ROOT/data/gpx" \
        --output-dir "$REPO_ROOT/preview" \
        --blog-dist "$REPO_ROOT/blog/dist" \
        --base-url "${BLOG_BASE_URL}"
    CDN_URL="${CDN_URL%/}"
    CDN_HOST=$(echo "$CDN_URL" | sed 's|https\?://||g')
    NGINX_CONF=$(mktemp --suffix=.conf)
    IMAGES_CDN_URL="$CDN_URL" IMAGES_CDN_HOST="$CDN_HOST" \
        envsubst '${IMAGES_CDN_URL}${IMAGES_CDN_HOST}' \
        < "$REPO_ROOT/nginx/cdn.conf.template" \
        > "$NGINX_CONF"
    echo "==> /images/ を $CDN_URL へプロキシ"
    CONTAINER_ID=$(docker run -d --rm -p 5000:80 \
        -v "$REPO_ROOT/preview":/usr/share/nginx/html \
        -v "$NGINX_CONF":/etc/nginx/conf.d/default.conf:ro \
        nginx:alpine)
    trap 'echo ""; echo "==> nginx を停止中..."; docker stop "$CONTAINER_ID" > /dev/null; rm -f "$NGINX_CONF"; exit 0' INT TERM

    echo "==> Preview: http://localhost:5000"
    echo "==> 監視中... (Ctrl+C で停止)"
    cargo watch \
        -C "$REPO_ROOT/cli" \
        -w "$REPO_ROOT/data" \
        -w "$REPO_ROOT/cli/src" \
        -w "$REPO_ROOT/cli/templates" \
        -w "$REPO_ROOT/blog/src" \
        --no-vcs-ignores \
        --ignore "*.sqlite3-shm" \
        --ignore "*.sqlite3-wal" \
        --no-restart \
        -d 1 \
        -s "find $REPO_ROOT/preview -mindepth 1 -delete && \
            cd $REPO_ROOT/blog && pnpm run build && \
            cd $REPO_ROOT/cli && cargo run -- build \
            --db $REPO_ROOT/data/blog.sqlite3 \
            --gpx-dir $REPO_ROOT/data/gpx \
            --output-dir $REPO_ROOT/preview \
            --blog-dist $REPO_ROOT/blog/dist \
            --base-url '$BLOG_BASE_URL' && \
            echo '==> ビルド完了 (ブラウザをリロードしてください)'"

# ビルド生成物を一括削除
clean:
    rm -rf editor/dist blog/dist preview
    cd cli && cargo clean
    cd editor/src-tauri && cargo clean

# エディタ を起動
editor:
    cd editor && npm run tauri:dev

# Rust・TypeScript の全テストを実行
test:
    cd cli && cargo test

# CD: ブログをビルドして S3 へ同期する
# 必要な環境変数: S3_BUCKET, AWS_REGION（AWS認証情報はaws CLIから自動取得）
# オプション環境変数: CLOUDFRONT_DISTRIBUTION_ID（設定時はキャッシュ無効化も実行）
deploy:
    #!/usr/bin/env bash
    set -euo pipefail
    REPO_ROOT="{{justfile_directory()}}"

    echo "==> blog/ をビルド中..."
    cd "$REPO_ROOT/blog" && pnpm install --frozen-lockfile && pnpm run build

    echo "==> cli/ を --release ビルドして HTML 生成中..."
    rm -rf "$REPO_ROOT/dist" && mkdir -p "$REPO_ROOT/dist"
    cd "$REPO_ROOT/cli" && cargo build --release
    sqlite3 "$REPO_ROOT/data/blog.sqlite3" "PRAGMA wal_checkpoint(FULL);"
    "$REPO_ROOT/cli/target/release/yamablog" build \
        --db "$REPO_ROOT/data/blog.sqlite3" \
        --gpx-dir "$REPO_ROOT/data/gpx" \
        --output-dir "$REPO_ROOT/dist" \
        --blog-dist "$REPO_ROOT/blog/dist" \
        --base-url "${BLOG_BASE_URL}"

    echo "==> S3 に同期中 (バケット: ${S3_BUCKET})..."
    aws s3 sync "$REPO_ROOT/dist/" "s3://${S3_BUCKET}/" \
        --delete \
        --exclude "images/*" \
        --region "${AWS_REGION}"

    echo "==> CloudFront キャッシュを無効化中..."
    aws cloudfront create-invalidation \
        --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
        --paths "/*"

    echo "==> デプロイ完了"

# CD: editor を Tauri --release ビルドする
# 成果物: editor/src-tauri/target/release/bundle/ 以下（.deb, .AppImage）
build-editor:
    #!/usr/bin/env bash
    set -euo pipefail
    REPO_ROOT="{{justfile_directory()}}"
    cd "$REPO_ROOT/editor" && pnpm install --frozen-lockfile && pnpm run tauri:build
    echo "==> ビルド成果物:"
    ls -lh "$REPO_ROOT/editor/src-tauri/target/release/bundle/"
