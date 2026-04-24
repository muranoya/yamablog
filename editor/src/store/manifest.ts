import { createStore } from "solid-js/store";
import { markDirty } from "./dirty";

// Minimal type that matches manifest.json structure
export interface ManifestData {
  version: number;
  blog: {
    name: string;
    top_image_id?: string;
    sidebar: {
      panels: Array<{ kind: string; visible: boolean }>;
    };
  };
  categories: Array<{ id: string; name: string; priority: number }>;
  directories: Array<{ id: string; name: string }>;
  articles: Array<{
    id: string;
    title: string;
    status: "published" | "draft";
    category_ids: string[];
    thumbnail_file_id?: string;
    gpx_file_id?: string;
    created_at: number;
  }>;
  map_memos: Array<{
    id: string;
    kind: number;
    lat: number;
    lng: number;
    memo: string;
    image_id?: string;
  }>;
}

type ManifestStore = { data: ManifestData | null };

const [store, setStore] = createStore<ManifestStore>({ data: null });

export function getManifest(): ManifestData | null {
  return store.data;
}

export function setManifest(m: ManifestData) {
  setStore("data", m);
}

export function updateBlogName(name: string) {
  setStore("data", "blog", "name", name);
  markDirty("manifest.json");
}

export function addArticle(article: ManifestData["articles"][number]) {
  setStore("data", "articles", (prev) => [...prev, article]);
  markDirty("manifest.json");
}

export function updateArticle(
  id: string,
  update: Partial<ManifestData["articles"][number]>
) {
  const idx = store.data?.articles.findIndex((a) => a.id === id) ?? -1;
  if (idx >= 0) {
    setStore("data", "articles", idx, update as any);
    markDirty("manifest.json");
  }
}

export function addCategory(name: string) {
  const id = crypto.randomUUID();
  const priority = store.data?.categories.length ?? 0;
  setStore("data", "categories", (prev) => [...prev, { id, name, priority }]);
  markDirty("manifest.json");
}

export function updateCategory(id: string, name: string) {
  const idx = store.data?.categories.findIndex((c) => c.id === id) ?? -1;
  if (idx >= 0) {
    setStore("data", "categories", idx, "name", name);
    markDirty("manifest.json");
  }
}

export function deleteCategory(id: string) {
  setStore("data", "categories", (prev) => prev.filter((c) => c.id !== id));
  markDirty("manifest.json");
}

export function moveCategoryUp(id: string) {
  const cats = store.data?.categories ?? [];
  const sorted = [...cats].sort((a, b) => a.priority - b.priority);
  const idx = sorted.findIndex((c) => c.id === id);
  if (idx <= 0) return;
  const newCats = cats.map((c) => {
    if (c.id === sorted[idx].id) return { ...c, priority: sorted[idx - 1].priority };
    if (c.id === sorted[idx - 1].id) return { ...c, priority: sorted[idx].priority };
    return c;
  });
  setStore("data", "categories", newCats);
  markDirty("manifest.json");
}

export function moveCategoryDown(id: string) {
  const cats = store.data?.categories ?? [];
  const sorted = [...cats].sort((a, b) => a.priority - b.priority);
  const idx = sorted.findIndex((c) => c.id === id);
  if (idx < 0 || idx >= sorted.length - 1) return;
  const newCats = cats.map((c) => {
    if (c.id === sorted[idx].id) return { ...c, priority: sorted[idx + 1].priority };
    if (c.id === sorted[idx + 1].id) return { ...c, priority: sorted[idx].priority };
    return c;
  });
  setStore("data", "categories", newCats);
  markDirty("manifest.json");
}

export function addMapMemo(memo: Omit<ManifestData["map_memos"][number], "id">) {
  const id = crypto.randomUUID();
  setStore("data", "map_memos", (prev) => [...prev, { id, ...memo }]);
  markDirty("manifest.json");
}

export function updateMapMemo(
  id: string,
  update: Partial<Omit<ManifestData["map_memos"][number], "id">>
) {
  const idx = store.data?.map_memos.findIndex((m) => m.id === id) ?? -1;
  if (idx >= 0) {
    setStore("data", "map_memos", idx, update as any);
    markDirty("manifest.json");
  }
}

export function deleteMapMemo(id: string) {
  setStore("data", "map_memos", (prev) => prev.filter((m) => m.id !== id));
  markDirty("manifest.json");
}
