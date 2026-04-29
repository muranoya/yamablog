# yamablog justfile

# レシピ一覧の表示
default:
    @just --list

# ファイル変更を監視して自動再ビルド + nginx プレビュー（Ctrl+C で全停止）
# CDN URLを指定すると /images/ へのアクセスを CDN へプロキシする
# 例: just watch cdn=https://d39entrefmn77d.cloudfront.net
watch cdn="":
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
        --blog-dist "$REPO_ROOT/blog/dist"
    CDN_URL="https://d39entrefmn77d.cloudfront.net"
    if [ -n "$CDN_URL" ]; then
        CDN_URL="${CDN_URL%/}"
        CDN_HOST=$(echo "$CDN_URL" | sed 's|https\?://||g')
        NGINX_CONF=$(mktemp --suffix=.conf)
        IMAGES_CDN_URL="$CDN_URL" IMAGES_CDN_HOST="$CDN_HOST" \
            envsubst '${IMAGES_CDN_URL}${IMAGES_CDN_HOST}' \
            < "$REPO_ROOT/nginx/cdn.conf.template" \
            > "$NGINX_CONF"
        echo "==> /images/ を $CDN_URL へプロキシ"
        CONTAINER_ID=$(docker run -d --rm -p 8080:80 \
            -v "$REPO_ROOT/preview":/usr/share/nginx/html \
            -v "$NGINX_CONF":/etc/nginx/conf.d/default.conf:ro \
            nginx:alpine)
        trap 'echo ""; echo "==> nginx を停止中..."; docker stop "$CONTAINER_ID" > /dev/null; rm -f "$NGINX_CONF"; exit 0' INT TERM
    else
        CONTAINER_ID=$(docker run -d --rm -p 8080:80 \
            -v "$REPO_ROOT/preview":/usr/share/nginx/html \
            -v "$REPO_ROOT/images":/usr/share/nginx/html/images:ro \
            nginx:alpine)
        trap 'echo ""; echo "==> nginx を停止中..."; docker stop "$CONTAINER_ID" > /dev/null; exit 0' INT TERM
    fi
    echo "==> Preview: http://localhost:8080"
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
            --blog-dist $REPO_ROOT/blog/dist && \
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
