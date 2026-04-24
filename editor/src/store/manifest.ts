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
    created_at: string;
    updated_at: string;
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
