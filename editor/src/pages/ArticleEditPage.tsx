import { createEffect, createSignal, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { getPublicImageUrl } from "../lib/s3";
import {
  getArticleBlocks,
  isArticleLoaded,
  setArticleBlocks,
  updateBlock,
  addBlock,
  removeBlock,
  moveBlock,
  saveArticleMetadata,
  type ArticleBlock,
} from "../store/article";
import { getManifest, updateArticleSummaryLocal } from "../store/manifest";
import { getImageByUuid } from "../store/files";
import TextBlock from "../components/blocks/TextBlock";
import ImageBlock from "../components/blocks/ImageBlock";
import GpxBlock from "../components/blocks/GpxBlock";
import GpxMapPreview from "../components/GpxMapPreview";
import FilePicker from "../components/FilePicker";
import ImageBatchPicker from "../components/ImageBatchPicker";
import { Button } from "../components/ui/Button";
import {
  ChevronLeftIcon,
  GripVerticalIcon,
  XIcon,
  PlusIcon,
  DocumentIcon,
  ImageIcon,
  RouteIcon,
  PencilIcon,
} from "../components/icons";

interface Props {
  articleId: number;
  onBack: () => void;
}

type FilePickerTarget = "thumbnail" | "gpx_meta" | { blockIndex: number };

export default function ArticleEditPage(props: Props) {
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showFilePicker, setShowFilePicker] = createSignal(false);
  const [showImageBatchPicker, setShowImageBatchPicker] = createSignal(false);
  const [filePickerKind, setFilePickerKind] = createSignal<"image" | "gpx">("image");
  const [filePickerTarget, setFilePickerTarget] = createSignal<FilePickerTarget>("thumbnail");
  const [editingSlug, setEditingSlug] = createSignal(false);
  const [slugInput, setSlugInput] = createSignal("");
  const [slugError, setSlugError] = createSignal<string | null>(null);
  const [draggingIndex, setDraggingIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  let titleTimer: number | null = null;

  createEffect(async () => {
    if (isArticleLoaded(props.articleId)) { setLoaded(true); return; }
    try {
      const blocks = await invoke<ArticleBlock[]>("db_get_article_blocks", {
        articleId: props.articleId,
      });
      setArticleBlocks(props.articleId, blocks);
      setLoaded(true);
    } catch {
      setError("記事の読み込みに失敗しました");
    }
  });

  const blocks = () => getArticleBlocks(props.articleId) ?? [];
  const meta = () => getManifest()?.articles.find((a) => a.id === props.articleId);
  const categories = () => getManifest()?.categories ?? [];

  function openFilePicker(kind: "image" | "gpx", target: FilePickerTarget) {
    setFilePickerKind(kind);
    setFilePickerTarget(target);
    setShowFilePicker(true);
  }

  function handleBatchImageSelect(uuids: string[]) {
    for (const uuid of uuids) {
      const img = getImageByUuid(uuid);
      addBlock(props.articleId, {
        kind: "image",
        text_content: "",
        image_id: img?.id ?? null,
        image_uuid: uuid,
        description: "",
        gpx_filename: "",
        shooting_datetime: img?.shooting_datetime ?? null,
      });
    }
    setShowImageBatchPicker(false);
  }

  function handleFilePickerSelect(value: string) {
    const target = filePickerTarget();
    if (target === "thumbnail") {
      const img = getImageByUuid(value);
      updateArticleSummaryLocal(props.articleId, {
        thumbnail_image_id: img?.id ?? null,
        thumbnail_image_uuid: value,
      });
      saveArticleMetadata(props.articleId).catch(console.error);
    } else if (target === "gpx_meta") {
      updateArticleSummaryLocal(props.articleId, { gpx_filename: value });
      saveArticleMetadata(props.articleId).catch(console.error);
    } else if (filePickerKind() === "gpx") {
      updateBlock(props.articleId, target.blockIndex, { gpx_filename: value }, true);
    } else {
      const img = getImageByUuid(value);
      updateBlock(
        props.articleId,
        target.blockIndex,
        { image_id: img?.id ?? null, image_uuid: value },
        true
      );
    }
    setShowFilePicker(false);
  }

  function handleToggleCategory(categoryId: number) {
    const current = meta()?.category_ids ?? [];
    const updated = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    updateArticleSummaryLocal(props.articleId, { category_ids: updated });
    saveArticleMetadata(props.articleId).catch(console.error);
  }

  function handleTitleInput(title: string) {
    updateArticleSummaryLocal(props.articleId, { title });
    if (titleTimer) clearTimeout(titleTimer);
    titleTimer = setTimeout(() => {
      saveArticleMetadata(props.articleId).catch(console.error);
      titleTimer = null;
    }, 300);
  }

  function handleStatusChange(status: "published" | "draft") {
    updateArticleSummaryLocal(props.articleId, { status });
    saveArticleMetadata(props.articleId).catch(console.error);
  }

  function commitSlugEdit() {
    const newSlug = slugInput().trim();
    const currentSlug = meta()?.slug ?? "";
    if (newSlug === currentSlug) { setEditingSlug(false); return; }
    if (!newSlug || !/^[a-z0-9-]+$/.test(newSlug)) {
      setSlugError("小文字英数字とハイフンのみ使用できます");
      return;
    }
    const articles = getManifest()?.articles ?? [];
    if (articles.some((a) => a.id !== props.articleId && a.slug === newSlug)) {
      setSlugError("このスラッグは既に使われています");
      return;
    }
    updateArticleSummaryLocal(props.articleId, { slug: newSlug });
    saveArticleMetadata(props.articleId).catch(console.error);
    setEditingSlug(false);
    setSlugError(null);
  }

  function handleDragStart(e: DragEvent, index: number) {
    setDraggingIndex(index);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", String(index));
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault();
    const from = draggingIndex();
    if (from !== null && from !== index) moveBlock(props.articleId, from, index);
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  const statusClasses = (s: string) =>
    s === "published"
      ? "bg-emerald-600 text-white"
      : "bg-white text-zinc-700 border border-zinc-200";

  return (
    <div class="flex h-full min-h-screen">
      {/* 左: メタデータパネル */}
      <div class="w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col overflow-y-auto">
        <div class="p-4 border-b border-zinc-100">
          <Button variant="ghost" size="sm" onClick={props.onBack}>
            <ChevronLeftIcon />
            記事一覧
          </Button>
        </div>

        <Show when={error()}>
          <div class="px-4 py-3 bg-red-50 border-b border-red-100">
            <p class="text-sm text-red-600">{error()}</p>
          </div>
        </Show>

        <Show when={loaded()}>
          <div class="flex-1 p-4 space-y-5">
            {/* ステータス */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-2">ステータス</p>
              <div class="flex rounded-lg border border-zinc-200 overflow-hidden">
                <button
                  class={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    meta()?.status === "draft"
                      ? statusClasses("draft")
                      : "text-zinc-400 hover:bg-zinc-50"
                  }`}
                  onClick={() => handleStatusChange("draft")}
                >
                  下書き
                </button>
                <button
                  class={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    meta()?.status === "published"
                      ? statusClasses("published")
                      : "text-zinc-400 hover:bg-zinc-50"
                  }`}
                  onClick={() => handleStatusChange("published")}
                >
                  公開
                </button>
              </div>
            </div>

            {/* タイトル */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-1.5">タイトル</p>
              <input
                type="text"
                class="w-full text-base font-bold text-zinc-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-2 py-1 -mx-2"
                value={meta()?.title ?? ""}
                onInput={(e) => handleTitleInput(e.currentTarget.value)}
                placeholder="記事タイトル"
              />
            </div>

            {/* スラッグ */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-1.5">スラッグ (URL)</p>
              <Show
                when={editingSlug()}
                fallback={
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-zinc-600 flex-1 bg-zinc-50 rounded px-2 py-1.5 truncate">
                      {meta()?.slug ?? ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSlugInput(meta()?.slug ?? "");
                        setSlugError(null);
                        setEditingSlug(true);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                  </div>
                }
              >
                <div class="space-y-1">
                  <div class="flex gap-1.5">
                    <input
                      type="text"
                      class="flex-1 border border-indigo-400 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={slugInput()}
                      onInput={(e) => {
                        setSlugInput(e.currentTarget.value);
                        setSlugError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitSlugEdit();
                        if (e.key === "Escape") setEditingSlug(false);
                      }}
                      autofocus
                    />
                    <Button variant="primary" size="sm" onClick={commitSlugEdit}>
                      確定
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSlug(false)}>
                      <XIcon />
                    </Button>
                  </div>
                  {slugError() && <p class="text-xs text-red-500">{slugError()}</p>}
                  <p class="text-xs text-zinc-400">小文字英数字とハイフンのみ</p>
                </div>
              </Show>
            </div>

            {/* カテゴリ */}
            <Show when={categories().length > 0}>
              <div>
                <p class="text-xs font-medium text-zinc-500 mb-2">カテゴリ</p>
                <div class="flex flex-wrap gap-1.5">
                  <For each={[...categories()].sort((a, b) => a.priority - b.priority)}>
                    {(cat) => {
                      const selected = () => meta()?.category_ids.includes(cat.id) ?? false;
                      return (
                        <button
                          class={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                            selected()
                              ? "bg-indigo-600 text-white"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                          onClick={() => handleToggleCategory(cat.id)}
                        >
                          {cat.name}
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>

            {/* サムネイル */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-2">サムネイル画像</p>
              <Show
                when={meta()?.thumbnail_image_uuid}
                fallback={
                  <button
                    class="w-full h-16 rounded-lg border-2 border-dashed border-zinc-200 text-xs text-zinc-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => openFilePicker("image", "thumbnail")}
                  >
                    <PlusIcon />
                    画像を選択
                  </button>
                }
              >
                {(uuid) => {
                  const previewUrl = () => getPublicImageUrl(uuid(), "small");
                  return (
                    <div class="space-y-2">
                      <div class="flex items-center gap-1.5">
                        <span class="font-mono text-xs text-zinc-500 flex-1 bg-zinc-50 rounded px-2 py-1.5 truncate min-w-0">
                          {uuid()}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => openFilePicker("image", "thumbnail")}>
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateArticleSummaryLocal(props.articleId, {
                              thumbnail_image_id: null,
                              thumbnail_image_uuid: null,
                            });
                            saveArticleMetadata(props.articleId).catch(console.error);
                          }}
                        >
                          <XIcon class="text-red-400" />
                        </Button>
                      </div>
                      <Show when={previewUrl()}>
                        <img
                          src={previewUrl()!}
                          class="w-full rounded-lg object-cover max-h-36 border border-zinc-200"
                        />
                      </Show>
                    </div>
                  );
                }}
              </Show>
            </div>

            {/* GPXファイル（記事全体） */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-2">GPXファイル（記事全体）</p>
              <Show
                when={meta()?.gpx_filename}
                fallback={
                  <button
                    class="w-full h-16 rounded-lg border-2 border-dashed border-zinc-200 text-xs text-zinc-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => openFilePicker("gpx", "gpx_meta")}
                  >
                    <PlusIcon />
                    GPXを選択
                  </button>
                }
              >
                <div class="space-y-2">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-xs text-zinc-500 flex-1 bg-zinc-50 rounded px-2 py-1.5 truncate min-w-0">
                      {meta()!.gpx_filename}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => openFilePicker("gpx", "gpx_meta")}>
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        updateArticleSummaryLocal(props.articleId, { gpx_filename: null });
                        saveArticleMetadata(props.articleId).catch(console.error);
                      }}
                    >
                      <XIcon class="text-red-400" />
                    </Button>
                  </div>
                  <GpxMapPreview filename={meta()!.gpx_filename!} mapHeightClass="h-36" />
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* 右: ブロックエディタ */}
      <div class="flex-1 overflow-y-auto bg-zinc-50">
        <Show when={loaded()}>
          <>
            {/* ブロック追加バー (sticky) */}
            <div class="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-sm px-6 py-3">
              <div class="max-w-2xl mx-auto flex items-center gap-2">
                <span class="text-xs text-zinc-500 mr-1">ブロックを追加</span>
                <button
                  onClick={() =>
                    addBlock(props.articleId, {
                      kind: "text",
                      text_content: "",
                      image_id: null,
                      image_uuid: null,
                      description: "",
                      gpx_filename: "",
                      shooting_datetime: null,
                    })
                  }
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  <DocumentIcon />
                  テキスト
                </button>
                <button
                  onClick={() => setShowImageBatchPicker(true)}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  <ImageIcon />
                  画像
                </button>
                <button
                  onClick={() =>
                    addBlock(props.articleId, {
                      kind: "gpx",
                      text_content: "",
                      image_id: null,
                      image_uuid: null,
                      description: "",
                      gpx_filename: "",
                      shooting_datetime: null,
                    })
                  }
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  <RouteIcon />
                  GPX
                </button>
              </div>
            </div>

            <div class="max-w-2xl mx-auto px-6 py-6">
              <div class="space-y-3">
                <For each={blocks()}>
                  {(block, i) => (
                    <div
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, i())}
                      onDragOver={(e) => handleDragOver(e, i())}
                      onDrop={(e) => handleDrop(e, i())}
                      onDragEnd={() => {
                        setDraggingIndex(null);
                        setDragOverIndex(null);
                      }}
                      class={`flex gap-0 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden transition-all ${
                        draggingIndex() === i() ? "opacity-40 scale-[0.98]" : ""
                      } ${
                        dragOverIndex() === i() && draggingIndex() !== i()
                          ? "ring-2 ring-indigo-400"
                          : ""
                      }`}
                    >
                      {/* ドラッグハンドルガター */}
                      <div
                        class="w-8 shrink-0 bg-zinc-50 border-r border-zinc-100 flex items-center justify-center cursor-grab active:cursor-grabbing"
                        title="ドラッグして並び替え"
                      >
                        <GripVerticalIcon class="text-zinc-300 hover:text-zinc-500" />
                      </div>

                      {/* ブロック本体 */}
                      <div class="flex-1 min-w-0">
                        <Show when={block.kind === "text"}>
                          <TextBlock
                            text={block.text_content}
                            onChange={(text) =>
                              updateBlock(props.articleId, i(), { text_content: text })
                            }
                          />
                        </Show>
                        <Show when={block.kind === "image"}>
                          <ImageBlock
                            imageUuid={block.image_uuid}
                            shootingDatetime={block.shooting_datetime}
                            description={block.description}
                            onDescriptionChange={(d) =>
                              updateBlock(props.articleId, i(), { description: d })
                            }
                            onSelectFile={() => openFilePicker("image", { blockIndex: i() })}
                          />
                        </Show>
                        <Show when={block.kind === "gpx"}>
                          <GpxBlock
                            filename={block.gpx_filename}
                            onSelectFile={() => openFilePicker("gpx", { blockIndex: i() })}
                          />
                        </Show>
                      </div>

                      {/* 削除ボタン */}
                      <button
                        onClick={() => removeBlock(props.articleId, i())}
                        class="shrink-0 w-8 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="削除"
                      >
                        <XIcon />
                      </button>
                    </div>
                  )}
                </For>
              </div>

              <Show when={blocks().length === 0}>
                <div class="flex flex-col items-center justify-center py-16 text-center">
                  <div class="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                    <DocumentIcon size={24} class="text-zinc-400" />
                  </div>
                  <p class="text-sm font-medium text-zinc-500">ブロックがありません</p>
                  <p class="text-xs text-zinc-400 mt-1">
                    上のボタンからブロックを追加してください
                  </p>
                </div>
              </Show>
            </div>
          </>
        </Show>
      </div>

      <Show when={showFilePicker()}>
        <FilePicker
          kind={filePickerKind()}
          onSelect={handleFilePickerSelect}
          onClose={() => setShowFilePicker(false)}
        />
      </Show>

      <Show when={showImageBatchPicker()}>
        <ImageBatchPicker
          onSelect={handleBatchImageSelect}
          onClose={() => setShowImageBatchPicker(false)}
        />
      </Show>
    </div>
  );
}
