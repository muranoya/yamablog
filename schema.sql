CREATE TABLE blog_config (
    id           INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
    name         TEXT    NOT NULL,
    top_image_id INTEGER REFERENCES images(id),
    updated_at   INTEGER NOT NULL
);

CREATE TABLE categories (
    id         INTEGER NOT NULL PRIMARY KEY,
    slug       TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE directories (
    id         INTEGER NOT NULL PRIMARY KEY,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE articles (
    id                 INTEGER NOT NULL PRIMARY KEY,
    slug               TEXT    NOT NULL UNIQUE,
    title              TEXT    NOT NULL,
    status             TEXT    NOT NULL CHECK (status IN ('published', 'draft')),
    thumbnail_image_id INTEGER REFERENCES images(id),
    gpx_filename       TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
);

CREATE TABLE article_categories (
    article_id  INTEGER NOT NULL REFERENCES articles(id)   ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, category_id)
);

CREATE TABLE article_blocks (
    id           INTEGER NOT NULL PRIMARY KEY,
    article_id   INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    sort_order   INTEGER NOT NULL,
    kind         TEXT    NOT NULL CHECK (kind IN ('text', 'image', 'gpx')),
    text_content TEXT,
    image_id     INTEGER REFERENCES images(id),
    description  TEXT,
    gpx_filename TEXT
);

CREATE TABLE images (
    id                INTEGER NOT NULL PRIMARY KEY,
    uuid              TEXT    NOT NULL UNIQUE,
    directory_id      INTEGER NOT NULL REFERENCES directories(id) ON DELETE CASCADE,
    name              TEXT    NOT NULL,
    small_width       INTEGER,
    small_height      INTEGER,
    medium_width      INTEGER,
    medium_height     INTEGER,
    original_width    INTEGER NOT NULL DEFAULT 0,
    original_height   INTEGER NOT NULL DEFAULT 0,
    shooting_datetime INTEGER,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);

CREATE TABLE map_memos (
    id         INTEGER NOT NULL PRIMARY KEY,
    kind       INTEGER NOT NULL,
    lat        REAL    NOT NULL,
    lng        REAL    NOT NULL,
    memo       TEXT    NOT NULL DEFAULT '',
    image_id   INTEGER REFERENCES images(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_articles_status      ON articles (status);
CREATE INDEX idx_articles_created_at  ON articles (created_at DESC);
CREATE INDEX idx_article_blocks_article ON article_blocks (article_id, sort_order);
CREATE INDEX idx_images_directory     ON images (directory_id);
