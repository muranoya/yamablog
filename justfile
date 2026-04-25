# yamablog justfile

# レシピ一覧の表示
default:
    @just --list

# ファイル変更を監視して自動再ビルド + nginx プレビュー（Ctrl+C で全停止）
watch:
    #!/usr/bin/env bash
    set -euo pipefail
    REPO_ROOT="{{justfile_directory()}}"
    echo "==> 初回ビルド中..."
    cd "$REPO_ROOT/blog" && pnpm run build
    cd "$REPO_ROOT/cli" && cargo run -- build \
        --data-dir "$REPO_ROOT/data" \
        --output-dir "$REPO_ROOT/preview"
    mkdir -p "$REPO_ROOT/preview/images"
    CONTAINER_ID=$(docker run -d --rm -p 8080:80 \
        -v "$REPO_ROOT/preview":/usr/share/nginx/html:ro \
        -v "$REPO_ROOT/images":/usr/share/nginx/html/images:ro \
        nginx:alpine)
    trap 'echo ""; echo "==> nginx を停止中..."; docker stop "$CONTAINER_ID" > /dev/null; exit 0' INT TERM
    echo "==> Preview: http://localhost:8080"
    echo "==> 監視中... (Ctrl+C で停止)"
    cargo watch \
        -C "$REPO_ROOT/cli" \
        -w "$REPO_ROOT/data" \
        -w "$REPO_ROOT/cli/src" \
        -w "$REPO_ROOT/cli/templates" \
        -w "$REPO_ROOT/blog/src" \
        --no-restart \
        -d 1 \
        -q \
        -s "cd $REPO_ROOT/blog && pnpm run build && \
            cd $REPO_ROOT/cli && cargo run -- build \
            --data-dir $REPO_ROOT/data \
            --output-dir $REPO_ROOT/preview && \
            echo '==> ビルド完了 (ブラウザをリロードしてください)'"

# ビルド生成物を一括削除
clean:
    rm -rf editor/dist blog/dist preview
    cd cli && cargo clean

# エディタ dev server を起動
editor:
    cd editor && pnpm run dev

# Rust・TypeScript の全テストを実行
test:
    cd cli && cargo test

# TypeScript型生成（スキーマ変更時のみ実行）
_gen-types:
    pnpm dlx json-schema-to-typescript schema/manifest.schema.json -o editor/src/types/manifest.ts
    pnpm dlx json-schema-to-typescript schema/article.schema.json -o editor/src/types/article.ts
    pnpm dlx json-schema-to-typescript schema/files.schema.json -o editor/src/types/files.ts
