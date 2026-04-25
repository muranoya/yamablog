#!/bin/bash

python3 tools/migrate_from_sqlite.py \
  --db      ./blog.sqlite3 \
  --output  ./data \
  --user-files /home/muraoka/work/yamablog/ \
  --images-out ./images
