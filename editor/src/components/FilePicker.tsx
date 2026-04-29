import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import L from "leaflet";
import { getManifest } from "../store/manifest";
import {
  getDirectoryImages,
  loadDirectoryImages,
  isLoaded,
  type DbImage,
} from "../store/files";
import { getGpxIndex, getGpxFile, getGpxEntry, type GpxIndexItem } from "../store/gpx";
import { parseGpxPolyline } from "../lib/gpx";
import { getPublicImageUrl } from "../lib/r2";
import { FolderIcon, ChevronDownIcon, ChevronRightIcon, RouteIcon, XIcon } from "./icons";

interface Props {
  kind: "image" | "gpx";
  onSelect: (value: string) => void;
  onClose: () => void;
}

function GpxPreviewMap(props: { filename: string }) {
  let mapRef: HTMLDivElement | undefined;
  let mapInstance: L.Map | null = null;
  let polyline: L.Polyline | null = null;

  const entry = () => getGpxEntry(props.filename);

  onMount(() => {
    mapInstance = L.map(mapRef!, {
      center: [35.5, 137.5],
      zoom: 7,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
      maxZoom: 18,
      minZoom: 5,
    }).addTo(mapInstance);
  });

  onCleanup(() => {
    mapInstance?.remove();
    mapInstance = null;
  });

  createEffect(async () => {
    const filename = props.filename;
    if (!mapInstance) return;
    if (polyline) { polyline.remove(); polyline = null; }
    if (!filename) return;
    const path = getGpxFile(filename);
    if (!path) return;

    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    try {
      const xml = await invoke<string>("read_file", { path });
      if (cancelled || !mapInstance) return;
      const points = parseGpxPolyline(xml);
      if (points.length === 0) return;
      polyline = L.polyline(points, { color: "#1d5c3e", weight: 3 }).addTo(mapInstance);
      mapInstance.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } catch (e) {
      if (!cancelled) console.error("GPXプレビュー:", e);
    }
  });

  return (
    <div class="flex flex-col gap-3 h-full">
      <div class="flex items-center flex-wrap gap-2 shrink-0">
        <Show
          when={entry()?.stats}
          fallback={
            <span class="text-xs text-zinc-400 font-mono truncate">{props.filename}</span>
          }
        >
          <span class="flex items-center gap-1 bg-[#1d5c3e]/10 text-[#1d5c3e] text-xs px-2.5 py-1 rounded-full font-medium">
            <RouteIcon />
            {(entry()!.stats!.distance_m / 1000).toFixed(1)} km
          </span>
          <Show when={entry()!.stats!.cum_climb_m > 0}>
            <span class="bg-zinc-100 text-zinc-600 text-xs px-2.5 py-1 rounded-full">
              ↑ {entry()!.stats!.cum_climb_m} m
            </span>
          </Show>
          <Show when={entry()!.stats!.start_at}>
            <span class="bg-zinc-100 text-zinc-600 text-xs px-2.5 py-1 rounded-full">
              {new Date(entry()!.stats!.start_at! * 1000).toISOString().slice(0, 10)}
            </span>
          </Show>
          <span class="text-xs text-zinc-400 truncate">{props.filename}</span>
        </Show>
      </div>
      <div style="isolation: isolate" class="flex-1 min-h-0">
        <div ref={mapRef} class="h-full w-full rounded-xl overflow-hidden border border-zinc-200" />
      </div>
    </div>
  );
}

export default function FilePicker(props: Props) {
  const [expandedDirs, setExpandedDirs] = createSignal<Set<number>>(new Set());
  const [loadingIds, setLoadingIds] = createSignal<Set<number>>(new Set());
  const [previewFile, setPreviewFile] = createSignal<string | null>(null);

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

  const title = () => (props.kind === "image" ? "画像を選択" : "GPXファイルを選択");

  const gpxFiles = () =>
    [...getGpxIndex()].sort((a: GpxIndexItem, b: GpxIndexItem) => {
      const at = a.stats?.start_at ?? 0;
      const bt = b.stats?.start_at ?? 0;
      if (at !== bt) return bt - at;
      return b.name.localeCompare(a.name);
    });

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <h2 class="text-base font-semibold text-zinc-900">{title()}</h2>
          <button
            onClick={props.onClose}
            class="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 画像: ディレクトリツリー */}
          <Show when={props.kind === "image"}>
            <div class="overflow-y-auto flex-1">
              <Show
                when={(getManifest()?.directories ?? []).length > 0}
                fallback={<p class="text-sm text-zinc-400 py-8 text-center">ディレクトリがありません</p>}
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
                              fallback={<p class="text-xs text-zinc-400 py-3 px-8">画像ファイルなし</p>}
                            >
                              <div class="p-3 pl-8 grid grid-cols-5 gap-2">
                                <For each={getDirectoryImages(dir.id) ?? []}>
                                  {(img: DbImage) => {
                                    const url = getPublicImageUrl(img.uuid, "small");
                                    return (
                                      <button
                                        class="rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-colors"
                                        onClick={() => props.onSelect(img.uuid)}
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
          </Show>

          {/* GPX: 2パネルレイアウト */}
          <Show when={props.kind === "gpx"}>
            <div class="flex flex-1 min-h-0">
              {/* 左パネル: ファイル一覧 */}
              <div class="w-64 shrink-0 border-r border-zinc-100 overflow-y-auto">
                <Show
                  when={gpxFiles().length > 0}
                  fallback={
                    <p class="text-sm text-zinc-400 py-8 text-center px-4">GPXファイルがありません</p>
                  }
                >
                  <div class="py-1">
                    <For each={gpxFiles()}>
                      {(item) => {
                        const isSelected = () => previewFile() === item.name;
                        return (
                          <button
                            class={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors border-b border-zinc-100 last:border-b-0 ${
                              isSelected()
                                ? "bg-[#1d5c3e]/8 border-l-2 border-l-[#1d5c3e]"
                                : "hover:bg-zinc-50 border-l-2 border-l-transparent"
                            }`}
                            onClick={() => setPreviewFile(item.name)}
                          >
                            <RouteIcon
                              class={isSelected() ? "text-[#1d5c3e] shrink-0" : "text-zinc-400 shrink-0"}
                            />
                            <div class="flex-1 min-w-0">
                              <p class={`text-sm truncate ${isSelected() ? "text-[#1d5c3e] font-medium" : "text-zinc-900"}`}>
                                {item.name}
                              </p>
                              <p class="text-xs text-zinc-400">
                                {item.stats ? `${(item.stats.distance_m / 1000).toFixed(1)} km` : ""}
                                {item.stats?.start_at
                                  ? ` · ${new Date(item.stats.start_at * 1000).toISOString().slice(0, 10)}`
                                  : ""}
                              </p>
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>

              {/* 右パネル: プレビュー */}
              <div class="flex-1 flex flex-col p-4 min-w-0 min-h-0">
                <Show
                  when={previewFile()}
                  fallback={
                    <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                      <RouteIcon class="text-zinc-300" size={32} />
                      <p class="text-sm text-zinc-400">左のリストからGPXファイルを選択してください</p>
                    </div>
                  }
                >
                  <div class="flex flex-col h-full gap-3">
                    <div class="flex-1 min-h-0">
                      <GpxPreviewMap filename={previewFile()!} />
                    </div>
                    <div class="shrink-0 flex justify-end pt-2 border-t border-zinc-100">
                      <button
                        class="flex items-center gap-2 px-4 py-2 bg-[#1d5c3e] text-white text-sm font-medium rounded-xl hover:bg-[#174d33] transition-colors"
                        onClick={() => props.onSelect(previewFile()!)}
                      >
                        <RouteIcon class="text-white" />
                        このファイルを選択
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
