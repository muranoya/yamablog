# yamablog 開発ガイド

trail-behind-them（Rust/Axum + SQLite + SolidJS SPA）の後継。サーバーレス構成で同等のブログサービスを提供する。

## アーキテクチャ概要

```
data/ (JSON + Git)  →  cli/ (Rust ビルドCLI)  →  クラウドストレージ (AWS S3などで静的配信)
                         ↑
editor/ (SolidJS SPA, GitHub Pages) ← webkitdirectory でdata/をインポート/エクスポート
                         ↓ クラウドストレージに直接アップロード (S3互換API)
                    メディアファイル (画像・GPX)
```

- サーバー不要。全ファイルをAWS S3のようなクラウドストレージから静的配信する
- コンテンツデータ（`data/`）はGitで管理し、変更履歴を追跡する
- 管理画面・ログイン機能は存在しない

## リポジトリ構成

```
yamablog/
  cli/      ← Rust ビルドCLI (yamablog build)
  editor/   ← SolidJS エディタSPA（GitHub Pagesでホスト）
  data/     ← コンテンツデータ（Gitで管理）
    manifest.json
    articles/<id>.json
    files/<dir-uuid>.json
```

## データ設計

### ファイル構成

| ファイル | 役割 |
|---|---|
| `data/manifest.json` | ブログ設定・カテゴリ・ディレクトリ一覧・記事サマリーを一元管理。エディタの単一エントリポイント。 |
| `data/articles/<id>.json` | 記事本文のみ。メタデータはmanifest.jsonが持つ。 |
| `data/files/<dir-uuid>.json` | ディレクトリ内のファイル一覧。ディレクトリごとに分割管理。 |

### 記事コンテンツ形式

記事本文はプレーンMarkdownではなく、ブロック配列のJSON。

```json
{
  "id": "fuji-2024-summer",
  "content": [
    { "kind": "text",   "content": { "text": "# タイトル\n\n本文..." } },
    { "kind": "image",  "content": { "file_id": "<uuid>", "description": "キャプション" } },
    { "kind": "gpx",    "content": { "file_id": "<uuid>" } },
    { "kind": "binary", "content": { "file_id": "<uuid>" } }
  ]
}
```

GPXブロックがある記事では、同記事内のimageブロックが持つ `shooting_datetime`（EXIFから取得）をGPXタイムラインと照合し、地図上にピン表示する。

### ディレクトリとファイル設計

ファイルはディレクトリ単位で `data/files/<dir-uuid>.json` に分割管理する。manifest.json はディレクトリのメタデータのみ持つ。

```json
// manifest.json の directories フィールド
"directories": [
  { "id": "<uuid>", "name": "2024年 夏山" }
]

// data/files/<dir-uuid>.json（そのディレクトリのファイル一覧）
[
  { "id": "<uuid>", "kind": "image", "name": "DSCF1234.jpg",
    "sizes": {
      "small":    { "width": 300,  "height": 200  },
      "medium":   { "width": 1024, "height": 683  },
      "original": { "width": 3000, "height": 2000 }
    },
    "shooting_datetime": "2024-08-01T08:30:00+09:00", "event_at": "2024-08-01" },
  { "id": "<uuid>", "kind": "gpx", "name": "2024-08-01-fuji.gpx",
    "event_at": "2024-08-01",
    "stats": { "distance_m": 12500, "cum_climb_m": 2300, ... } }
]
```

- files・map_memos のIDはUUID。articles・categories のIDはユーザーが設定する `[a-z0-9-]` の文字列で、URLパスに使用する
- `name` はアップロード時の元ファイル名を記録する（ストレージ上のパスはUUIDを使用）
- 画像はアップロード時にWebPに変換する
- GPX statsはエディタがアップロード時にパースして保存する
- エディタはディレクトリを開いたときのみ `data/files/<dir-uuid>.json` を遅延読み込みする

### クラウドストレージ上のパス規則

```
media/<uuid>-small.webp       # 画像（small）
media/<uuid>-medium.webp      # 画像（medium）
media/<uuid>-original.webp    # 画像（original）
media/<uuid>.gpx              # GPXファイル
index.html                    # 記事一覧トップ（1ページ目）
2/index.html                  # 記事一覧 2ページ目（以降同様）
articles/<id>/index.html      # 記事ページ
categories/<id>/index.html    # カテゴリページ
archives/<yyyy>/<mm>/index.html
map-data.json                 # 全公開GPXポリライン + 全マップメモ（地図用）
assets/bundle.js
assets/bundle.css
```

## ビルドCLI (cli/)

```sh
yamablog build           # data/ を読んでHTMLを生成してクラウドストレージにアップロード
yamablog build --dry-run # ローカル出力のみ（アップロードしない）
```

### 処理フロー

1. `manifest.json`・`data/files/*.json`・`articles/*.json` を読み込む
2. Markdownブロックを `pulldown-cmark` でHTMLに変換
3. GPXファイルをクラウドストレージから公開HTTP経由でフェッチし、polylineとbounding boxを計算
4. GPXブロックがある記事は `shooting_datetime` とGPXタイムラインを照合してピン座標を生成
5. Teraテンプレートで静的HTMLを生成（記事一覧はページネーション分を全て生成）
6. 全公開記事のGPXポリライン＋全マップメモを `map-data.json` として生成
7. クラウドストレージにアップロード（S3互換API）

### 想定クレート

- `tera` — テンプレートエンジン
- `pulldown-cmark` — Markdownパーサー
- `aws-sdk-s3` — S3互換アップロード
- `reqwest` — クラウドストレージからのGPXファイル取得（公開HTTP経由）
- `serde` / `serde_json` — JSON読み込み

## エディタSPA (editor/)

### データアクセス方針

- **インポート**: `<input type="file" webkitdirectory>` で `data/` フォルダを選択する。`manifest.json` を即時読み込み、記事JSONはその記事を開いたとき、`files/<dir-uuid>.json` はそのディレクトリを開いたときに遅延読み込み。
- **エクスポート**: 変更されたJSONファイルのみダウンロード。`data/` フォルダに手動で上書き保存する。
- File System Access APIは使用しない（Firefox非対応のため）

### 画像アップロード

ブラウザのCanvas APIで small・medium・original の3サイズにリサイズしてWebPに変換してからクラウドストレージにアップロードする。EXIFから `shooting_datetime` を抽出する。

### クラウドストレージ接続設定

アクセスキー・シークレット・バケット名・エンドポイントURLをエディタ起動時にパスフレーズとともに入力する。Web Crypto API（PBKDF2でキー導出 + AES-GCM暗号化）で暗号化し、暗号化済みBlob + saltを `localStorage` に保存する。パスフレーズ自体はセッション中のみメモリに保持する。

## 公開ブログ

### ページ構成

| URL | 内容 |
|---|---|
| `/` | 記事一覧トップ（1ページ目） |
| `/2/`, `/3/`, ... | 記事一覧 2ページ目以降 |
| `/articles/<id>/` | 記事詳細 |
| `/categories/<id>/` | カテゴリ別記事一覧（ページネーションあり） |
| `/archives/<yyyy>/<mm>/` | 月別記事一覧 |

### HTML生成方針

- テキストコンテンツ・画像はHTMLに直接含める（クローラー対応）
- GPXのpolylineとピン座標はビルド時に `data-*` 属性としてHTMLに埋め込む
- サイドバーのGPX軌跡地図・マップメモはブラウザJSが `map-data.json` を取得してLeafletで描画する
- ブラウザJSは地図（Leaflet）・ライトボックス・標高グラフ（uplot）など動的部分のみ担当

## 採用しないもの

- Cloudflare Workers：無料枠のCPU実行時間制限（10ms）が懸念
- Cloudflare Pages：Workersへの移行が推奨されており採用しない
- GitHub Pages（メディア配信）：既存データが8GB超のため容量制限に抵触する
