#!/usr/bin/env python3
"""
trail-behind-them SQLite → yamablog JSON 移行スクリプト

Usage:
  python3 tools/migrate_from_sqlite.py \
    --db /path/to/blog.sqlite3 \
    --output ./data

出力:
  data/manifest.json
  data/articles/<id>.json
  data/files/<dir-uuid>.json

注意事項:
  - カテゴリ・記事のIDは英数字タイトルからスラグ生成を試みる。
    日本語タイトルは category-<番号> / article-<番号> 形式になる。
    エディタで後から変更可能。
  - 画像の "large" サイズは yamablog の "medium" にリネームされる。
  - R2上のメディアファイルのパスが変わるため、別途ファイルの移行・再アップロードが必要。
  - shooting_datetime はUTCとして解釈しUnix timestampに変換する。
"""

import argparse
import json
import re
import shutil
import sqlite3
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path


def new_uuid() -> str:
    return str(uuid.uuid4())


def _to_unix_ts(dt_str) -> int | None:
    """SQLiteの日時文字列をUTCとして解釈しUnix timestampに変換する。"""
    if not dt_str:
        return None
    s = str(dt_str).strip()[:19]  # "YYYY-MM-DD HH:MM:SS" または "YYYY-MM-DD"
    dt = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def slugify(text: str) -> str:
    """文字列から [a-z0-9-] のスラグを生成。変換できない場合は空文字を返す。"""
    normalized = unicodedata.normalize("NFKD", text.lower())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return slug


def make_unique_id(base: str, used: set) -> str:
    candidate = base
    n = 2
    while candidate in used:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def convert_sidebar(old_settings: str | None) -> dict:
    """trail-behind-them の sidebar_settings → yamablog の sidebar オブジェクトに変換。"""
    default = {
        "panels": [
            {"kind": "gpx_map",    "visible": True},
            {"kind": "categories", "visible": True},
            {"kind": "monthly",    "visible": True},
        ]
    }
    if not old_settings:
        return default
    try:
        panels = json.loads(old_settings)
        # 旧形式: [{"key": "gpx_map", "visible": true}, ...]
        # 新形式: {"panels": [{"kind": "gpx_map", "visible": true}, ...]}
        converted = [{"kind": p["key"], "visible": p.get("visible", True)} for p in panels]
        return {"panels": converted}
    except (json.JSONDecodeError, KeyError):
        return default


def convert_image_data(raw: dict) -> tuple[dict, int | None]:
    """trail-behind-them の image data → (sizes dict, shooting_datetime as Unix timestamp)"""
    sizes = {}
    size_key_map = {"original": "original", "large": "medium", "small": "small"}
    for old_key, new_key in size_key_map.items():
        s = raw.get(old_key)
        if isinstance(s, dict):
            sizes[new_key] = {"width": s.get("width"), "height": s.get("height")}
    # large サイズが存在しない場合は original で補完
    if "original" in sizes and "medium" not in sizes:
        sizes["medium"] = sizes["original"]
    shooting_datetime = _to_unix_ts(raw.get("shooting_datetime"))
    return sizes, shooting_datetime


def convert_gpx_stats(raw: dict) -> dict:
    """trail-behind-them の gpx data → yamablog の stats フィールド。"""
    result = {}
    for k in ("start_at", "end_at"):
        if k in raw:
            result[k] = _to_unix_ts(raw[k])
    for k in ("distance_m", "cum_climb_m", "cum_down_m", "max_elevation_m", "min_elevation_m"):
        if k in raw:
            result[k] = raw[k]
    return result


def convert_media_files(
    conn: sqlite3.Connection,
    file_id_map: dict,
    user_files_base: Path,
    media_out: Path,
) -> None:
    """user_files 内の画像・GPX を media/ に WebP 変換またはコピーする。"""
    try:
        from PIL import Image
    except ImportError:
        sys.exit("エラー: Pillow が必要です。`pip install Pillow` でインストールしてください。")

    media_out.mkdir(parents=True, exist_ok=True)
    cur = conn.cursor()
    cur.execute("SELECT id, kind, data FROM files")
    rows = cur.fetchall()
    total = len(rows)

    images_ok = images_skip = gpx_ok = gpx_skip = 0

    for i, row in enumerate(rows, 1):
        print(f"\r  {i}/{total} 処理中...", end="", flush=True)

        new_uuid_str = file_id_map.get(row["id"])
        if not new_uuid_str:
            continue

        raw = json.loads(row["data"]) if row["data"] else {}

        if row["kind"] == 0:  # image
            size_map = {
                "original": f"{new_uuid_str}-original.webp",
                "large":    f"{new_uuid_str}-medium.webp",
                "small":    f"{new_uuid_str}-small.webp",
            }
            for key, out_name in size_map.items():
                s = raw.get(key, {})
                rel = s.get("path") if isinstance(s, dict) else None
                if not rel:
                    continue
                src = user_files_base / rel
                dst = media_out / out_name
                if not src.exists():
                    images_skip += 1
                    print(f"\n  警告: {src} が見つかりません", flush=True)
                    continue
                with Image.open(src) as img:
                    img.save(dst, "webp", quality=85, method=6)
                images_ok += 1

        elif row["kind"] == 2:  # gpx
            rel = raw.get("path")
            if not rel:
                continue
            src = user_files_base / rel
            dst = media_out / f"{new_uuid_str}.gpx"
            if not src.exists():
                gpx_skip += 1
                print(f"\n  警告: {src} が見つかりません", flush=True)
                continue
            shutil.copy2(src, dst)
            gpx_ok += 1

    print()
    skipped = images_skip + gpx_skip
    print(
        f"✓ media/   画像 {images_ok} WebP 変換 / GPX {gpx_ok} コピー"
        + (f" / {skipped} 件スキップ（ファイル不在）" if skipped else "")
    )


def main():
    parser = argparse.ArgumentParser(
        description="trail-behind-them SQLite → yamablog JSON 移行スクリプト"
    )
    parser.add_argument("--db", required=True, help="SQLiteファイルのパス")
    parser.add_argument("--output", required=True, help="出力先ディレクトリ（data/）")
    parser.add_argument(
        "--user-files",
        metavar="PATH",
        help="user_files ルートディレクトリ（メディア変換時に必要）",
    )
    parser.add_argument(
        "--media-out",
        metavar="PATH",
        help="media 出力ディレクトリ（メディア変換時に必要）",
    )
    args = parser.parse_args()

    if bool(args.user_files) != bool(args.media_out):
        sys.exit("エラー: --user-files と --media-out は両方同時に指定してください。")

    output = Path(args.output)
    (output / "articles").mkdir(parents=True, exist_ok=True)
    (output / "files").mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ────────────────────────────────────────────────
    # IDマッピング生成
    # ────────────────────────────────────────────────

    # ファイル: 旧int ID → 新UUID
    cur.execute("SELECT id FROM files")
    file_id_map: dict[int, str] = {row["id"]: new_uuid() for row in cur.fetchall()}

    # ディレクトリ: 旧int ID → 新UUID
    cur.execute("SELECT id FROM directories")
    dir_id_map: dict[int, str] = {row["id"]: new_uuid() for row in cur.fetchall()}

    # カテゴリ: 旧int ID → [a-z0-9-] 文字列
    cur.execute("SELECT id, name FROM categories")
    cat_id_map: dict[int, str] = {}
    used_ids: set[str] = set()
    for row in cur.fetchall():
        base = slugify(row["name"]) or f"category-{row['id']}"
        cat_id = make_unique_id(base, used_ids)
        used_ids.add(cat_id)
        cat_id_map[row["id"]] = cat_id

    # 記事: 旧int ID → [a-z0-9-] 文字列
    cur.execute("SELECT id, title FROM articles")
    article_id_map: dict[int, str] = {}
    used_ids = set()
    for row in cur.fetchall():
        base = slugify(row["title"]) or f"article-{row['id']}"
        # スラグが短すぎる場合はIDベースにフォールバック
        if len(base) < 3:
            base = f"article-{row['id']}"
        article_id = make_unique_id(base, used_ids)
        used_ids.add(article_id)
        article_id_map[row["id"]] = article_id

    # マップメモ: 旧int ID → 新UUID
    cur.execute("SELECT id FROM map_memos")
    memo_id_map: dict[int, str] = {row["id"]: new_uuid() for row in cur.fetchall()}

    # ────────────────────────────────────────────────
    # manifest.json を組み立て
    # ────────────────────────────────────────────────

    # ブログ設定
    cur.execute("SELECT top_image_file_id, sidebar_settings FROM blogs LIMIT 1")
    blog_row = cur.fetchone()
    top_image_id = None
    sidebar = convert_sidebar(None)
    if blog_row:
        if blog_row["top_image_file_id"]:
            top_image_id = file_id_map.get(blog_row["top_image_file_id"])
        sidebar = convert_sidebar(blog_row["sidebar_settings"])

    # カテゴリ
    cur.execute("SELECT id, name, priority FROM categories ORDER BY priority")
    categories = [
        {"id": cat_id_map[r["id"]], "name": r["name"], "priority": r["priority"]}
        for r in cur.fetchall()
    ]

    # ディレクトリ
    cur.execute("SELECT id, name FROM directories ORDER BY id")
    directories = [
        {"id": dir_id_map[r["id"]], "name": r["name"]}
        for r in cur.fetchall()
    ]

    # 記事サマリー
    cur.execute("""
        SELECT id, title, status, thumbnail, gpx_file_id, created_at
        FROM articles ORDER BY created_at DESC
    """)
    articles_meta = []
    for r in cur.fetchall():
        cur.execute(
            "SELECT category_id FROM article_category WHERE article_id = ?", (r["id"],)
        )
        cat_ids = [
            cat_id_map[cr["category_id"]]
            for cr in cur.fetchall()
            if cr["category_id"] in cat_id_map
        ]
        articles_meta.append({
            "id": article_id_map[r["id"]],
            "title": r["title"],
            "status": "published" if r["status"] == 1 else "draft",
            "category_ids": cat_ids,
            "thumbnail_file_id": file_id_map.get(r["thumbnail"]) if r["thumbnail"] else None,
            "gpx_file_id": file_id_map.get(r["gpx_file_id"]) if r["gpx_file_id"] else None,
            "created_at": _to_unix_ts(r["created_at"]),
        })

    # マップメモ
    cur.execute("SELECT id, kind, lat, lng, memo, image_id FROM map_memos")
    map_memos = [
        {
            "id": memo_id_map[r["id"]],
            "kind": r["kind"],
            "lat": r["lat"],
            "lng": r["lng"],
            "memo": r["memo"] or "",
            "image_id": file_id_map.get(r["image_id"]) if r["image_id"] else None,
        }
        for r in cur.fetchall()
    ]

    manifest = {
        "version": 1,
        "blog": {
            "name": "Trail Behind Them",  # 必要に応じて変更してください
            "top_image_id": top_image_id,
            "sidebar": sidebar,
        },
        "categories": categories,
        "directories": directories,
        "articles": articles_meta,
        "map_memos": map_memos,
    }

    with open(output / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"✓ manifest.json  ({len(articles_meta)} 記事 / {len(categories)} カテゴリ"
          f" / {len(directories)} ディレクトリ / {len(map_memos)} マップメモ)")

    # ────────────────────────────────────────────────
    # data/files/<dir-uuid>.json を生成
    # ────────────────────────────────────────────────

    cur.execute("SELECT id, directory_id, name, kind, data FROM files")
    files_by_dir: dict[str, list] = {}
    skipped = 0
    for r in cur.fetchall():
        dir_uuid = dir_id_map.get(r["directory_id"])
        if dir_uuid is None:
            skipped += 1
            continue

        file_uuid = file_id_map[r["id"]]
        raw_data = json.loads(r["data"]) if r["data"] else {}
        kind_int_to_str = {0: "image", 1: "binary", 2: "gpx"}
        kind = kind_int_to_str.get(r["kind"], "binary")

        entry: dict = {"id": file_uuid, "kind": kind, "name": r["name"] or ""}

        if kind == "image":
            sizes, shooting_datetime = convert_image_data(raw_data)
            entry["sizes"] = sizes
            if shooting_datetime:
                entry["shooting_datetime"] = shooting_datetime

        elif kind == "gpx":
            stats = convert_gpx_stats(raw_data)
            if stats:
                entry["stats"] = stats

        # binary は追加フィールドなし（パスはname拡張子から導出）

        files_by_dir.setdefault(dir_uuid, []).append(entry)

    for dir_uuid, files in files_by_dir.items():
        path = output / "files" / f"{dir_uuid}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(files, f, ensure_ascii=False, indent=2)

    total_files = sum(len(v) for v in files_by_dir.values())
    print(f"✓ data/files/    ({total_files} ファイル / {len(files_by_dir)} ディレクトリ"
          + (f" / {skipped} 件スキップ（ディレクトリなし）" if skipped else "") + ")")

    # ────────────────────────────────────────────────
    # data/articles/<id>.json を生成
    # ────────────────────────────────────────────────

    cur.execute("SELECT id, content FROM articles")
    article_count = 0
    for r in cur.fetchall():
        article_id_str = article_id_map[r["id"]]
        content_blocks = []

        if r["content"]:
            try:
                raw = json.loads(r["content"])
                for block in raw.get("contents", []):
                    kind = block.get("kind")
                    bc = block.get("content", {})
                    if kind == "text":
                        content_blocks.append(
                            {"kind": "text", "content": {"text": bc.get("text", "")}}
                        )
                    elif kind == "image":
                        old_fid = bc.get("file_id")
                        content_blocks.append({
                            "kind": "image",
                            "content": {
                                "file_id": file_id_map.get(old_fid, "") if old_fid else "",
                                "description": bc.get("description", ""),
                            },
                        })
                    elif kind == "gpx":
                        old_fid = bc.get("file_id")
                        content_blocks.append({
                            "kind": "gpx",
                            "content": {
                                "file_id": file_id_map.get(old_fid, "") if old_fid else "",
                            },
                        })
                    elif kind == "binary":
                        old_fid = bc.get("file_id")
                        content_blocks.append({
                            "kind": "binary",
                            "content": {
                                "file_id": file_id_map.get(old_fid, "") if old_fid else "",
                            },
                        })
                    else:
                        print(f"  警告: 記事 {r['id']} に未知のブロック種別 '{kind}'")
            except (json.JSONDecodeError, KeyError) as e:
                print(f"  警告: 記事 {r['id']} のコンテンツ解析エラー: {e}")

        article_data = {"id": article_id_str, "content": content_blocks}
        path = output / "articles" / f"{article_id_str}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(article_data, f, ensure_ascii=False, indent=2)
        article_count += 1

    print(f"✓ data/articles/ ({article_count} 記事)")

    if args.user_files and args.media_out:
        print("\nメディアファイルを変換中...")
        convert_media_files(
            conn,
            file_id_map,
            Path(args.user_files),
            Path(args.media_out),
        )

    conn.close()

    print("\n移行完了。")
    print("次の手順:")
    print("  1. manifest.json の blog.name を実際のブログ名に変更する")
    print("  2. 日本語タイトルから生成された article-<番号> / category-<番号> ID を")
    print("     エディタで任意のスラグに変更する（URLに影響）")
    if not (args.user_files and args.media_out):
        print("  3. メディアファイル（画像・GPX）を変換・アップロードする")
        print("     --user-files と --media-out を指定して再実行すると自動変換できます")
    else:
        print("  3. media/ の WebP・GPX ファイルを R2 にアップロードする")


if __name__ == "__main__":
    main()
