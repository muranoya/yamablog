# yamablog

山岳登山記録に特化したサーバーレス静的ブログシステム。記事中のGPX軌跡・写真・テキストをブロック単位で管理し、静的HTMLとして生成・配信する。

## 特徴

- **GPX × 写真の自動マッチング** — 写真のEXIF撮影時刻とGPXタイムラインを照合し、地図上に撮影地点ピンを自動配置
- **ブロック構造の記事管理** — 記事本文をテキスト・画像・GPXのブロック配列で管理。ブロックの並び替え・差し替えが容易
- **サーバーレス配信** — 静的HTMLにテキスト・画像を直接埋め込むためクローラー対応。配信インフラはS3+CloudFront想定
- **Tauri GUIエディタ** — 記事・カテゴリ・画像・マップメモをデスクトップアプリで編集し、そのままクラウドへアップロード
- **ブラウザJSは動的部分のみ** — Leaflet地図・uplot標高グラフ・ライトボックスなど、HTMLだけでは実現できない機能のみJSが担当

## アーキテクチャ

```
┌─────────────────────────────┐
│   editor/  (Tauri GUI)      │  記事・カテゴリ・画像・マップメモを編集
└──────────────┬──────────────┘
               │ 書き込み
               ▼
   data/blog.sqlite3  +  data/gpx/*.gpx
               │
               │ 読み込み
               ▼
┌─────────────────────────────┐
│   cli/  (Rust)              │  静的HTML生成
│   + blog/ JS バンドル       │
└──────────────┬──────────────┘
               │
               ▼
          dist/  (静的HTML + assets)
               │
               ▼
             AWS S3
               │
               ▼
          ブラウザに配信
```

## コンポーネント

| ディレクトリ | 役割 |
|---|---|
| `cli/` | SQLite + GPX を読み込み静的HTMLを生成するRustコマンド |
| `editor/` | データ編集用デスクトップアプリ（Tauri 2 + Solid.js） |
| `blog/` | ブラウザで動くJSバンドル（地図・グラフ・ライトボックス） |
| `data/` | SQLiteデータベース（`blog.sqlite3`）とGPXファイル |
| `schema.sql` | SQLiteスキーマ定義。`bin/migrate.sh` で反映 |

## 技術スタック

| 区分 | 技術 |
|---|---|
| 静的HTML生成 | Rust, Tera, pulldown-cmark |
| GUIエディタ | Tauri 2, Solid.js, Tailwind CSS |
| ブラウザJS | TypeScript, Vite, Leaflet, uplot |
| データ | SQLite3, GPX |
| ストレージ | AWS S3 |

## 使い方

**前提環境**: Rust, Node.js (pnpm), Docker, [just](https://github.com/casey/just)

```bash
# 依存インストール
cd blog && pnpm install && cd ..
cd editor && pnpm install && cd ..

# GUIエディタ起動（記事・画像・設定の編集）
just editor

# ローカルプレビュー（ファイル変更を監視して自動ビルド、localhost:8080）
just watch

# スキーマ変更を反映
bin/migrate.sh
```

## 生成ページ構成

| URL | 内容 |
|---|---|
| `/` | 記事一覧（1ページ目） |
| `/articles/<slug>/` | 記事詳細 |
| `/categories/<slug>/` | カテゴリ別記事一覧 |
| `/archives/<mm>/` | 月別記事一覧 |
| `/map-data.json` | 全公開GPXポリライン + マップメモ（地図サイドバー用） |
