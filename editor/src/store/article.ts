import { createStore } from "solid-js/store";
import { markDirty } from "./dirty";

export interface ContentBlock {
  kind: "text" | "image" | "gpx" | "binary";
  content: Record<string, unknown>;
}

export interface ArticleData {
  id: string;
  content: ContentBlock[];
}

const articleCache = new Map<string, ReturnType<typeof createStore<ArticleData>>>();
let articleFileMap = new Map<string, File>();

export function setArticleFileMap(map: Map<string, File>) {
  articleFileMap = map;
}

export function getArticleFile(id: string): File | undefined {
  return articleFileMap.get(id);
}

export function getArticleStore(id: string): ArticleData | undefined {
  return articleCache.get(id)?.[0];
}

export function loadArticle(id: string, article: ArticleData) {
  if (!articleCache.has(id)) {
    articleCache.set(id, createStore<ArticleData>(article));
  }
}

export function updateBlock(
  articleId: string,
  blockIndex: number,
  contentUpdate: Record<string, unknown>
) {
  const store = articleCache.get(articleId);
  if (!store) return;
  store[1]("content", blockIndex, "content", contentUpdate as any);
  markDirty(`articles/${articleId}.json`);
}

export function addBlock(articleId: string, block: ContentBlock) {
  const store = articleCache.get(articleId);
  if (!store) return;
  store[1]("content", (prev) => [...prev, block]);
  markDirty(`articles/${articleId}.json`);
}

export function removeBlock(articleId: string, blockIndex: number) {
  const store = articleCache.get(articleId);
  if (!store) return;
  store[1]("content", (prev) => prev.filter((_, i) => i !== blockIndex));
  markDirty(`articles/${articleId}.json`);
}

export function getArticleData(id: string): ArticleData | undefined {
  return articleCache.get(id)?.[0];
}
