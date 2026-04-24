import { createSignal, For, Show } from "solid-js";
import { getManifest } from "../store/manifest";
import {
  getDirectoryFiles,
  getFileEntryFile,
  isLoaded,
  markLoading,
  markLoadingDone,
  setDirectoryFiles,
  type FileEntry,
  type GpxFile,
  type ImageFile,
} from "../store/files";
import { readJsonFile } from "../lib/importer";

export default function FilesPage() {
  const [expandedDirs, setExpandedDirs] = createSignal<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = createSignal<Set<string>>(new Set());

  async function toggleDir(dirId: string) {
    const next = new Set(expandedDirs());
    if (next.has(dirId)) {
      next.delete(dirId);
      setExpandedDirs(next);
      return;
    }
    next.add(dirId);
    setExpandedDirs(next);

    if (!isLoaded(dirId) && !loadingIds().has(dirId)) {
      const file = getFileEntryFile(dirId);
      if (file) {
        setLoadingIds((prev) => new Set([...prev, dirId]));
        markLoading(dirId);
        try {
          const entries = await readJsonFile<FileEntry[]>(file);
          setDirectoryFiles(dirId, entries);
        } catch (e) {
          console.error("ファイル読み込みエラー:", e);
        } finally {
          markLoadingDone(dirId);
          setLoadingIds((prev) => {
            const s = new Set(prev);
            s.delete(dirId);
            return s;
          });
        }
      }
    }
  }

  return (
    <div class="max-w-3xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-6">ファイル</h1>
      <Show
        when={(getManifest()?.directories ?? []).length > 0}
        fallback={<p class="text-gray-400">ディレクトリがありません。</p>}
      >
        <For each={getManifest()?.directories ?? []}>
          {(dir) => (
            <div class="mb-2">
              <button
                onClick={() => toggleDir(dir.id)}
                class="w-full text-left flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition"
              >
                <span class="font-medium">{dir.name}</span>
                <span class="text-gray-400 text-sm">
                  {expandedDirs().has(dir.id) ? "▲" : "▼"}
                </span>
              </button>

              <Show when={expandedDirs().has(dir.id)}>
                <div class="mt-1 pl-4 border-l-2 border-gray-100">
                  <Show
                    when={isLoaded(dir.id)}
                    fallback={
                      <p class="text-sm text-gray-400 py-2 pl-2">
                        {loadingIds().has(dir.id) ? "読み込み中..." : "（ファイルなし）"}
                      </p>
                    }
                  >
                    <Show
                      when={(getDirectoryFiles(dir.id) ?? []).length > 0}
                      fallback={
                        <p class="text-sm text-gray-400 py-2 pl-2">ファイルなし</p>
                      }
                    >
                      <For each={getDirectoryFiles(dir.id) ?? []}>
                        {(entry) => (
                          <div class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 border-b border-gray-50 last:border-0">
                            <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                              {entry.kind}
                            </span>
                            <span class="flex-1 truncate">{entry.name}</span>
                            <Show when={entry.kind === "gpx"}>
                              <span class="text-xs text-gray-400 shrink-0">
                                {(entry as GpxFile).stats?.distance_m != null
                                  ? `${((entry as GpxFile).stats.distance_m / 1000).toFixed(1)} km`
                                  : ""}
                              </span>
                            </Show>
                            <Show when={entry.kind === "gpx" && !!(entry as GpxFile).stats?.start_at}>
                              <span class="text-xs text-gray-400 shrink-0">
                                {new Date((entry as GpxFile).stats.start_at! * 1000).toISOString().substring(0, 10)}
                              </span>
                            </Show>
                            <Show when={entry.kind === "image" && !!(entry as ImageFile).shooting_datetime}>
                              <span class="text-xs text-gray-400 shrink-0">
                                {new Date((entry as ImageFile).shooting_datetime! * 1000).toISOString().substring(0, 10)}
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </Show>
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
