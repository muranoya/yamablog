import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { getManifest } from "./manifest";

export interface ArticleBlock {
  kind: "text" | "image" | "gpx";
  text_content: string;
  image_id: number | null;
  image_uuid: string | null;
  description: string;
  gpx_filename: string;
  shooting_datetime: number | null;
}

const [blocksStore, setBlocksStore] = createStore<Record<string, ArticleBlock[]>>({});
const loadedSet = new Set<number>();

export function getArticleBlocks(articleId: number): ArticleBlock[] | undefined {
  return blocksStore[articleId];
}

export function isArticleLoaded(articleId: number): boolean {
  return loadedSet.has(articleId);
}

export function setArticleBlocks(articleId: number, blocks: ArticleBlock[]): void {
  setBlocksStore(articleId.toString(), blocks);
  loadedSet.add(articleId);
}

function toUpsertInput(block: ArticleBlock) {
  return {
    kind: block.kind,
    text_content: block.kind === "text" ? block.text_content : null,
    image_id: block.kind === "image" ? block.image_id : null,
    description: block.kind === "image" ? block.description : null,
    gpx_filename: block.kind === "gpx" ? block.gpx_filename : null,
  };
}

async function saveArticle(articleId: number): Promise<void> {
  const article = getManifest()?.articles.find((a) => a.id === articleId);
  if (!article) return;
  const blocks = blocksStore[articleId] ?? [];
  await invoke("db_upsert_article", {
    input: {
      id: articleId,
      slug: article.slug,
      title: article.title,
      status: article.status,
      thumbnail_image_id: article.thumbnail_image_id ?? null,
      gpx_filename: article.gpx_filename ?? null,
      created_at: article.created_at,
      category_ids: article.category_ids,
      blocks: blocks.map(toUpsertInput),
    },
  });
}

export async function saveArticleMetadata(articleId: number): Promise<void> {
  await saveArticle(articleId);
}

let saveTimer: number | null = null;
function debouncedSave(articleId: number) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveArticle(articleId).catch(console.error);
    saveTimer = null;
  }, 300);
}

export function updateBlock(
  articleId: number,
  index: number,
  update: Partial<ArticleBlock>,
  immediate = false
): void {
  const key = articleId.toString();
  setBlocksStore(key, index, update as any);
  if (immediate) saveArticle(articleId).catch(console.error);
  else debouncedSave(articleId);
}

export function addBlock(articleId: number, block: ArticleBlock): void {
  const key = articleId.toString();
  setBlocksStore(key, (prev) => [...(prev ?? []), block]);
  saveArticle(articleId).catch(console.error);
}

export function removeBlock(articleId: number, index: number): void {
  const key = articleId.toString();
  setBlocksStore(key, (prev) => prev.filter((_, i) => i !== index));
  saveArticle(articleId).catch(console.error);
}

export function moveBlock(articleId: number, from: number, to: number): void {
  const blocks = blocksStore[articleId];
  if (!blocks || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return;
  const next = [...blocks];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  setBlocksStore(articleId.toString(), next);
  saveArticle(articleId).catch(console.error);
}
