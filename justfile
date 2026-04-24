# yamablog justfile

# TypeScript型生成（スキーマ変更時のみ実行）
gen-types:
    npx json-schema-to-typescript schema/manifest.schema.json -o editor/src/types/manifest.ts
    npx json-schema-to-typescript schema/article.schema.json -o editor/src/types/article.ts
    npx json-schema-to-typescript schema/files.schema.json -o editor/src/types/files.ts

# CLIビルド
cli-build:
    cd cli && cargo build --release

# エディタビルド
editor-build:
    cd editor && npm run build

# 全ビルド
build: cli-build editor-build

# CLIテスト
cli-test:
    cd cli && cargo test

# dry-run プレビュー
preview:
    cd cli && cargo run -- build --dry-run --data-dir ../data --output-dir /tmp/yamablog-preview
    @echo "Preview: open /tmp/yamablog-preview/index.html"
