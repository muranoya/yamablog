import { createSignal, For, Show } from "solid-js";
import { getManifest } from "../store/manifest";
import {
  getDirectoryImages,
  loadDirectoryImages,
  isLoaded,
  type DbImage,
} from "../store/files";
import { getSmallSrc } from "../lib/r2";
import { Button } from "./ui/Button";
import { FolderIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "./icons";

interface Props {
  onSelect: (uuids: string[]) => void;
  onClose: () => void;
}

type SortKey = "shooting_datetime" | "name";
type SortOrder = "asc" | "desc";

function sortImages(images: DbImage[], key: SortKey, order: SortOrder): DbImage[] {
  return [...images].sort((a, b) => {
    if (key === "shooting_datetime") {
      const aHas = a.shooting_datetime !== null;
      const bHas = b.shooting_datetime !== null;
      if (!aHas && !bHas) return a.name.localeCompare(b.name);
      if (!aHas) return 1;
      if (!bHas) return -1;
      const diff = a.shooting_datetime! - b.shooting_datetime!;
      if (diff !== 0) return order === "asc" ? diff : -diff;
      return a.name.localeCompare(b.name);
    }
    const nd = a.name.localeCompare(b.name);
    return order === "asc" ? nd : -nd;
  });
}

export default function ImageBatchPicker(props: Props) {
  const [expandedDirs, setExpandedDirs] = createSignal<Set<number>>(new Set());
  const [loadingIds, setLoadingIds] = createSignal<Set<number>>(new Set());
  const [selectedUuids, setSelectedUuids] = createSignal<string[]>([]);
  const [sortKey, setSortKey] = createSignal<SortKey>("shooting_datetime");
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("asc");

  async function toggleDir(dirId: number) {
    const next = new Set(expandedDirs());
    if (next.has(dirId)) {
      next.delete(dirId);
      setExpandedDirs(next);
      return;
    }
    next.add(dirId);
    setExpandedDirs(next);

    if (!isLoaded(dirId) && !loadingIds().has(dirId)) {
      setLoadingIds((prev) => new Set([...prev, dirId]));
      try {
        await loadDirectoryImages(dirId);
      } catch {
        // silently ignore
      } finally {
        setLoadingIds((prev) => {
          const s = new Set(prev);
          s.delete(dirId);
          return s;
        });
      }
    }
  }

  function toggleSelect(uuid: string) {
    setSelectedUuids((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid]
    );
  }

  function selectAllInDir(dirId: number) {
    const uuids = sortImages(getDirectoryImages(dirId) ?? [], sortKey(), sortOrder()).map(
      (i) => i.uuid
    );
    setSelectedUuids((prev) => {
      const existing = new Set(prev);
      return [...prev, ...uuids.filter((u) => !existing.has(u))];
    });
  }

  function deselectAllInDir(dirId: number) {
    const dirUuids = new Set((getDirectoryImages(dirId) ?? []).map((i) => i.uuid));
    setSelectedUuids((prev) => prev.filter((u) => !dirUuids.has(u)));
  }

  const count = () => selectedUuids().length;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div class="flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
          <h2 class="text-base font-semibold text-zinc-900 mr-auto">画像を複数選択</h2>

          <div class="flex items-center gap-2">
            <span class="text-xs text-zinc-400">並び替え</span>
            <select
              class="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={sortKey()}
              onChange={(e) => setSortKey(e.currentTarget.value as SortKey)}
            >
              <option value="shooting_datetime">撮影日時</option>
              <option value="name">ファイル名</option>
            </select>
            <button
              class="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-zinc-50 transition-colors font-mono"
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              title={sortOrder() === "asc" ? "昇順（クリックで降順）" : "降順（クリックで昇順）"}
            >
              {sortOrder() === "asc" ? "↑ 昇順" : "↓ 降順"}
            </button>
          </div>

          <button
            onClick={props.onClose}
            class="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* ディレクトリツリー + 画像グリッド */}
        <div class="overflow-y-auto flex-1">
          <Show
            when={(getManifest()?.directories ?? []).length > 0}
            fallback={
              <p class="text-sm text-zinc-400 py-8 text-center">ディレクトリがありません</p>
            }
          >
            <For
              each={[...(getManifest()?.directories ?? [])].sort(
                (a, b) => b.created_at - a.created_at
              )}
            >
              {(dir) => (
                <div>
                  <button
                    onClick={() => toggleDir(dir.id)}
                    class="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors border-b border-zinc-100"
                  >
                    <FolderIcon class="text-zinc-400 shrink-0" />
                    <span class="flex-1 text-sm font-medium text-zinc-900">{dir.name}</span>
                    {expandedDirs().has(dir.id)
                      ? <ChevronDownIcon class="text-zinc-400" />
                      : <ChevronRightIcon class="text-zinc-400" />
                    }
                  </button>

                  <Show when={expandedDirs().has(dir.id)}>
                    <div class="bg-zinc-50/50">
                      <Show when={isLoaded(dir.id) && (getDirectoryImages(dir.id) ?? []).length > 0}>
                        <div class="flex items-center gap-3 px-8 py-1.5 border-b border-zinc-100">
                          <button
                            class="text-xs text-indigo-600 hover:underline"
                            onClick={() => selectAllInDir(dir.id)}
                          >
                            全選択
                          </button>
                          <button
                            class="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
                            onClick={() => deselectAllInDir(dir.id)}
                          >
                            全解除
                          </button>
                        </div>
                      </Show>
                      <Show
                        when={isLoaded(dir.id)}
                        fallback={
                          <p class="text-xs text-zinc-400 py-3 px-8">
                            {loadingIds().has(dir.id) ? "読み込み中..." : ""}
                          </p>
                        }
                      >
                        <Show
                          when={(getDirectoryImages(dir.id) ?? []).length > 0}
                          fallback={
                            <p class="text-xs text-zinc-400 py-3 px-8">画像ファイルなし</p>
                          }
                        >
                          <div class="p-3 pl-8 grid grid-cols-5 gap-2">
                            <For
                              each={sortImages(
                                getDirectoryImages(dir.id) ?? [],
                                sortKey(),
                                sortOrder()
                              )}
                            >
                              {(img: DbImage) => {
                                const url = getSmallSrc(img);
                                const selIndex = () => selectedUuids().indexOf(img.uuid);
                                const selected = () => selIndex() >= 0;
                                return (
                                  <button
                                    class={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                                      selected()
                                        ? "border-indigo-500 ring-1 ring-indigo-400"
                                        : "border-transparent hover:border-indigo-300"
                                    }`}
                                    onClick={() => toggleSelect(img.uuid)}
                                    title={img.name}
                                  >
                                    <Show
                                      when={url}
                                      fallback={
                                        <div class="aspect-square bg-zinc-200 flex items-center justify-center text-zinc-400 text-xs">
                                          {img.name.slice(0, 6)}
                                        </div>
                                      }
                                    >
                                      <img
                                        src={url!}
                                        alt={img.name}
                                        class="aspect-square object-cover w-full"
                                        loading="lazy"
                                      />
                                    </Show>

                                    <Show when={selected()}>
                                      <div class="absolute top-1 left-1 bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow">
                                        {selIndex() + 1}
                                      </div>
                                    </Show>
                                  </button>
                                );
                              }}
                            </For>
                          </div>
                        </Show>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>

        {/* フッター */}
        <div class="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <div class="flex items-center gap-3">
            <span class="text-sm text-zinc-500">
              {count() > 0 ? `${count()} 枚選択中` : "画像をクリックして選択"}
            </span>
            <Show when={count() > 0}>
              <button
                class="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
                onClick={() => setSelectedUuids([])}
              >
                全解除
              </button>
            </Show>
          </div>
          <div class="flex gap-2">
            <Button variant="ghost" size="sm" onClick={props.onClose}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={count() === 0}
              onClick={() => props.onSelect(selectedUuids())}
            >
              {count() > 0 ? `${count()} 枚を追加` : "追加"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
