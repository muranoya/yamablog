import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

export interface DbBlogConfig {
  name: string;
  top_image_id: number | null;
  top_image_uuid: string | null;
  updated_at: number;
}

export interface DbCategory {
  id: number;
  slug: string;
  name: string;
  priority: number;
  created_at: number;
  updated_at: number;
}

export interface DbDirectory {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface DbArticleSummary {
  id: number;
  slug: string;
  title: string;
  status: "published" | "draft";
  thumbnail_image_id: number | null;
  thumbnail_image_uuid: string | null;
  gpx_filename: string | null;
  created_at: number;
  updated_at: number;
  category_ids: number[];
}

export interface DbMapMemo {
  id: number;
  kind: number;
  lat: number;
  lng: number;
  memo: string;
  image_id: number | null;
  image_uuid: string | null;
  created_at: number;
  updated_at: number;
}

interface ManifestStore {
  blog: DbBlogConfig | null;
  categories: DbCategory[];
  directories: DbDirectory[];
  articles: DbArticleSummary[];
  map_memos: DbMapMemo[];
}

const [store, setStore] = createStore<ManifestStore>({
  blog: null,
  categories: [],
  directories: [],
  articles: [],
  map_memos: [],
});

export function getManifest() {
  if (!store.blog) return null;
  return store;
}

export function getBlog(): DbBlogConfig | null { return store.blog; }
export function getCategories(): DbCategory[] { return store.categories; }
export function getDirectories(): DbDirectory[] { return store.directories; }
export function getArticles(): DbArticleSummary[] { return store.articles; }
export function getMapMemos(): DbMapMemo[] { return store.map_memos; }

export function setAllData(data: {
  blog: DbBlogConfig;
  categories: DbCategory[];
  directories: DbDirectory[];
  articles: DbArticleSummary[];
  map_memos: DbMapMemo[];
}) {
  setStore({
    blog: data.blog,
    categories: data.categories,
    directories: data.directories,
    articles: data.articles,
    map_memos: data.map_memos,
  });
}

// ── Blog ──────────────────────────────────────────────────────────────────

export function updateBlogName(name: string) {
  setStore("blog", "name", name);
}

export async function saveBlogConfig(): Promise<void> {
  if (!store.blog) return;
  await invoke("db_upsert_blog_config", {
    input: { name: store.blog.name, top_image_id: store.blog.top_image_id },
  });
}

export async function updateBlogTopImage(
  imageId: number | null,
  imageUuid: string | null
): Promise<void> {
  setStore("blog", "top_image_id", imageId);
  setStore("blog", "top_image_uuid", imageUuid);
  if (!store.blog) return;
  await invoke("db_upsert_blog_config", {
    input: { name: store.blog.name, top_image_id: imageId },
  });
}

// ── Categories ────────────────────────────────────────────────────────────

export async function addCategory(slug: string, name: string): Promise<number> {
  const priority = store.categories.length;
  const id = await invoke<number>("db_upsert_category", {
    input: { id: null, slug, name, priority },
  });
  const now = Math.floor(Date.now() / 1000);
  setStore("categories", [...store.categories, { id, slug, name, priority, created_at: now, updated_at: now }]);
  return id;
}

export async function updateCategory(id: number, slug: string, name: string): Promise<void> {
  const idx = store.categories.findIndex((c) => c.id === id);
  if (idx < 0) return;
  setStore("categories", idx, { slug, name });
  await invoke("db_upsert_category", {
    input: { id, slug, name, priority: store.categories[idx].priority },
  });
}

export async function deleteCategory(id: number): Promise<void> {
  setStore("categories", (prev) => prev.filter((c) => c.id !== id));
  for (let i = 0; i < store.articles.length; i++) {
    if (store.articles[i].category_ids.includes(id)) {
      setStore("articles", i, "category_ids",
        store.articles[i].category_ids.filter((cid) => cid !== id));
    }
  }
  await invoke("db_delete_category", { id });
}

export async function reorderCategories(orderedIds: number[]): Promise<void> {
  const newCats = store.categories.map((c) => {
    const priority = orderedIds.indexOf(c.id);
    return priority >= 0 ? { ...c, priority } : c;
  });
  setStore("categories", newCats);
  for (const cat of newCats) {
    invoke("db_upsert_category", {
      input: { id: cat.id, slug: cat.slug, name: cat.name, priority: cat.priority },
    }).catch(console.error);
  }
}

// ── Directories ───────────────────────────────────────────────────────────

export async function addDirectory(name: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const id = await invoke<number>("db_upsert_directory", {
    input: { id: null, name },
  });
  setStore("directories", [...store.directories, { id, name, created_at: now, updated_at: now }]);
  return id;
}

export async function updateDirectory(id: number, name: string): Promise<void> {
  const idx = store.directories.findIndex((d) => d.id === id);
  if (idx >= 0) setStore("directories", idx, "name", name);
  await invoke("db_upsert_directory", { input: { id, name } });
}

export async function deleteDirectory(id: number): Promise<void> {
  setStore("directories", (prev) => prev.filter((d) => d.id !== id));
  await invoke("db_delete_directory", { id });
}

// ── Articles ──────────────────────────────────────────────────────────────

export async function addArticle(
  slug: string,
  title: string,
  status: "published" | "draft",
  created_at: number
): Promise<number> {
  const id = await invoke<number>("db_upsert_article", {
    input: {
      id: null,
      slug,
      title,
      status,
      thumbnail_image_id: null,
      gpx_filename: null,
      created_at,
      category_ids: [],
      blocks: [],
    },
  });
  const now = Math.floor(Date.now() / 1000);
  setStore("articles", [...store.articles, {
    id, slug, title, status,
    thumbnail_image_id: null,
    thumbnail_image_uuid: null,
    gpx_filename: null,
    created_at,
    updated_at: now,
    category_ids: [],
  }]);
  return id;
}

export async function deleteArticle(id: number): Promise<void> {
  setStore("articles", (prev) => prev.filter((a) => a.id !== id));
  await invoke("db_delete_article", { id });
}

export function updateArticleSummaryLocal(id: number, update: Partial<DbArticleSummary>): void {
  const idx = store.articles.findIndex((a) => a.id === id);
  if (idx >= 0) setStore("articles", idx, update as any);
}

// ── Map Memos ─────────────────────────────────────────────────────────────

export async function addMapMemo(
  kind: number,
  lat: number,
  lng: number,
  memo: string,
  imageId: number | null,
  imageUuid: string | null
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const id = await invoke<number>("db_upsert_map_memo", {
    input: { id: null, kind, lat, lng, memo, image_id: imageId },
  });
  setStore("map_memos", [...store.map_memos, {
    id, kind, lat, lng, memo,
    image_id: imageId,
    image_uuid: imageUuid,
    created_at: now,
    updated_at: now,
  }]);
  return id;
}

export async function updateMapMemo(
  id: number,
  update: Partial<Pick<DbMapMemo, "kind" | "memo" | "image_id" | "image_uuid">>
): Promise<void> {
  const idx = store.map_memos.findIndex((m) => m.id === id);
  if (idx < 0) return;
  setStore("map_memos", idx, update as any);
  const m = store.map_memos[idx];
  await invoke("db_upsert_map_memo", {
    input: { id, kind: m.kind, lat: m.lat, lng: m.lng, memo: m.memo, image_id: m.image_id },
  });
}

export async function deleteMapMemo(id: number): Promise<void> {
  setStore("map_memos", (prev) => prev.filter((m) => m.id !== id));
  await invoke("db_delete_map_memo", { id });
}
