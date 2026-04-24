#!/bin/bash

python3 tools/migrate_from_sqlite.py \
  --db      /home/muraoka/work/trail-behind-them/server/blog.sqlite3 \
  --output  ./data \
  --user-files /home/muraoka/work/yamablog/ \
  --media-out  ./media
