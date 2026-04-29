import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import L from "leaflet";
import { getManifest, addMapMemo, updateMapMemo, deleteMapMemo } from "../store/manifest";
import type { DbMapMemo } from "../store/manifest";
import { MAP_MEMO_KINDS, createMarkerIcon } from "../lib/leafletIconHelper";
import { getDirectoryImages } from "../store/files";
import type { DbImage } from "../store/files";
import { getPublicImageUrl } from "../lib/r2";
import { Button } from "../components/ui/Button";
import { Lightbox } from "../components/ui/Lightbox";
import { XIcon, MapPinIcon, ImageIcon, EyeIcon } from "../components/icons";

interface ImageRef {
  id: number;
  uuid: string;
}

interface PendingLatLng {
  lat: number;
  lng: number;
}

export default function MapMemoPage() {
  let mapRef: HTMLDivElement | undefined;
  let mapInstance: L.Map | null = null;
  const markerMap = new Map<number, L.Marker>();
  let pendingMarker: L.Marker | null = null;

  const [panelOpen, setPanelOpen] = createSignal(false);
  const [pendingLatLng, setPendingLatLng] = createSignal<PendingLatLng | null>(null);
  const [selectedMemo, setSelectedMemo] = createSignal<DbMapMemo | null>(null);

  const [newKind, setNewKind] = createSignal(0);
  const [newMemo, setNewMemo] = createSignal("");
  const [newImageRef, setNewImageRef] = createSignal<ImageRef | null>(null);
  const [editKind, setEditKind] = createSignal(0);
  const [editMemo, setEditMemo] = createSignal("");
  const [editImageRef, setEditImageRef] = createSignal<ImageRef | null>(null);
  const [imageModalOpen, setImageModalOpen] = createSignal(false);
  const [lightboxUrl, setLightboxUrl] = createSignal<string | null>(null);

  const isAdding = () => !!pendingLatLng();

  function round7(v: number): number {
    return Math.round(v * 1e7) / 1e7;
  }

  function allLoadedImages(): Array<{ dirName: string; img: DbImage }> {
    const manifest = getManifest();
    if (!manifest) return [];
    const result: Array<{ dirName: string; img: DbImage }> = [];
    for (const dir of manifest.directories) {
      const images = getDirectoryImages(dir.id);
      if (!images) continue;
      for (const img of images) {
        result.push({ dirName: dir.name, img });
      }
    }
    return result;
  }

  function currentKind() { return isAdding() ? newKind() : editKind(); }
  function setCurrentKind(v: number) {
    if (isAdding()) {
      setNewKind(v);
      if (pendingMarker) pendingMarker.setIcon(createMarkerIcon(v));
    } else {
      setEditKind(v);
    }
  }
  function currentMemoText() { return isAdding() ? newMemo() : editMemo(); }
  function setCurrentMemoText(v: string) { if (isAdding()) setNewMemo(v); else setEditMemo(v); }
  function currentImageRef() { return isAdding() ? newImageRef() : editImageRef(); }
  function setCurrentImageRef(ref: ImageRef | null) {
    if (isAdding()) setNewImageRef(ref); else setEditImageRef(ref);
  }

  function addMarkerForMemo(memo: DbMapMemo) {
    if (!mapInstance) return;
    const icon = createMarkerIcon(memo.kind);
    const marker = L.marker([memo.lat, memo.lng], { icon }).addTo(mapInstance);
    marker.on("click", () => {
      setPendingLatLng(null);
      clearPendingMarker();
      setSelectedMemo(memo);
      setEditKind(memo.kind);
      setEditMemo(memo.memo);
      setEditImageRef(
        memo.image_id !== null && memo.image_uuid !== null
          ? { id: memo.image_id, uuid: memo.image_uuid }
          : null
      );
      setPanelOpen(true);
    });
    markerMap.set(memo.id, marker);
  }

  function clearPendingMarker() {
    if (pendingMarker) { pendingMarker.remove(); pendingMarker = null; }
  }

  onMount(() => {
    mapInstance = L.map(mapRef!, {
      center: [35.81, 139.16],
      zoom: 10,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
      maxZoom: 18,
      minZoom: 5,
    }).addTo(mapInstance);

    for (const memo of getManifest()?.map_memos ?? []) {
      addMarkerForMemo(memo);
    }

    mapInstance.on("click", (e: L.LeafletMouseEvent) => {
      setSelectedMemo(null);
      clearPendingMarker();
      const lat = round7(e.latlng.lat);
      const lng = round7(e.latlng.lng);
      setPendingLatLng({ lat, lng });
      setNewKind(0);
      setNewMemo("");
      setNewImageRef(null);
      setPanelOpen(true);
      pendingMarker = L.marker([lat, lng], {
        icon: createMarkerIcon(0),
        opacity: 0.6,
      }).addTo(mapInstance!);
    });
  });

  onCleanup(() => { mapInstance?.remove(); mapInstance = null; });

  async function handleCreate() {
    const pos = pendingLatLng();
    if (!pos) return;
    const ref = newImageRef();
    const id = await addMapMemo(
      newKind(),
      pos.lat,
      pos.lng,
      newMemo(),
      ref?.id ?? null,
      ref?.uuid ?? null
    );
    const saved = getManifest()?.map_memos.find((m) => m.id === id);
    if (saved) addMarkerForMemo(saved);
    clearPendingMarker();
    setPanelOpen(false);
    setPendingLatLng(null);
  }

  async function handleUpdate() {
    const memo = selectedMemo();
    if (!memo) return;
    const ref = editImageRef();
    await updateMapMemo(memo.id, {
      kind: editKind(),
      memo: editMemo(),
      image_id: ref?.id ?? null,
      image_uuid: ref?.uuid ?? null,
    });
    markerMap.get(memo.id)?.remove();
    markerMap.delete(memo.id);
    const updated = getManifest()?.map_memos.find((m) => m.id === memo.id);
    if (updated) addMarkerForMemo(updated);
    setPanelOpen(false);
    setSelectedMemo(null);
  }

  async function handleDelete() {
    const memo = selectedMemo();
    if (!memo) return;
    await deleteMapMemo(memo.id);
    markerMap.get(memo.id)?.remove();
    markerMap.delete(memo.id);
    setPanelOpen(false);
    setSelectedMemo(null);
  }

  function handleCancel() {
    clearPendingMarker();
    setPanelOpen(false);
    setPendingLatLng(null);
    setSelectedMemo(null);
  }

  const memoCount = () => getManifest()?.map_memos.length ?? 0;

  return (
    <div class="relative flex h-full" style="height: calc(100vh - 0px)">
      {/* Leaflet マップ */}
      <div ref={mapRef!} class="flex-1 min-h-0" />

      {/* 浮遊HUD */}
      <Show when={!panelOpen()}>
        <div class="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl border border-zinc-200 shadow-sm px-4 py-2.5 flex items-center gap-2.5 pointer-events-none">
          <MapPinIcon class="text-indigo-500" />
          <div>
            <p class="text-xs font-semibold text-zinc-900">{memoCount()} 件のメモ</p>
            <p class="text-xs text-zinc-400">地図をクリックしてピンを追加</p>
          </div>
        </div>
      </Show>

      {/* サイドパネル */}
      <Show when={panelOpen()}>
        <div class="w-80 bg-white border-l border-zinc-200 shrink-0 flex flex-col overflow-hidden">
          {/* パネルヘッダー */}
          <div class="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isAdding() ? "bg-indigo-100" : "bg-zinc-100"
                }`}
              >
                <MapPinIcon class={isAdding() ? "text-indigo-600" : "text-zinc-600"} />
              </div>
              <h2 class="text-sm font-semibold text-zinc-900">
                {isAdding() ? "ピンを追加" : "ピンを編集"}
              </h2>
            </div>
            <button
              onClick={handleCancel}
              class="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <XIcon />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 座標表示 */}
            <div>
              {pendingLatLng() && (
                <p class="font-mono text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500">
                  {pendingLatLng()!.lat.toFixed(6)}, {pendingLatLng()!.lng.toFixed(6)}
                </p>
              )}
              {selectedMemo() && (
                <p class="font-mono text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500">
                  {selectedMemo()!.lat.toFixed(6)}, {selectedMemo()!.lng.toFixed(6)}
                </p>
              )}
            </div>

            {/* ピン種別 */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-2">種類</p>
              <div class="grid grid-cols-2 gap-1.5">
                <For each={MAP_MEMO_KINDS}>
                  {(k) => (
                    <button
                      class={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                        currentKind() === k.id
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-400"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                      onClick={() => setCurrentKind(k.id)}
                    >
                      {k.name}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* メモ */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-2">メモ</p>
              <textarea
                value={currentMemoText()}
                onInput={(e) => setCurrentMemoText(e.currentTarget.value)}
                rows={4}
                class="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="メモを入力..."
              />
            </div>

            {/* 画像 */}
            <div>
              <p class="text-xs font-medium text-zinc-500 mb-2">画像</p>
              <Show
                when={currentImageRef()}
                fallback={
                  <button
                    onClick={() => setImageModalOpen(true)}
                    class="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-300 rounded-lg text-sm text-zinc-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                  >
                    <ImageIcon />
                    画像を選択
                  </button>
                }
              >
                {(ref) => {
                  const smallUrl = getPublicImageUrl(ref().uuid, "small");
                  const mediumUrl = getPublicImageUrl(ref().uuid, "medium");
                  return (
                    <div class="relative">
                      <Show
                        when={smallUrl}
                        fallback={
                          <div class="w-full h-16 bg-zinc-100 rounded-lg flex items-center justify-center">
                            <span class="font-mono text-xs text-zinc-500 truncate px-2">
                              {ref().uuid}
                            </span>
                          </div>
                        }
                      >
                        <img
                          src={smallUrl!}
                          class="w-full h-28 object-cover rounded-lg border border-zinc-200 cursor-pointer"
                          onClick={() => {
                            const url = mediumUrl ?? smallUrl;
                            if (url) setLightboxUrl(url);
                          }}
                        />
                      </Show>
                      <button
                        onClick={() => {
                          const url = mediumUrl ?? smallUrl;
                          if (url) setLightboxUrl(url);
                        }}
                        class="absolute bottom-1.5 left-1.5 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                        title="拡大"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        onClick={() => setCurrentImageRef(null)}
                        class="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                        title="画像を解除"
                      >
                        <XIcon />
                      </button>
                    </div>
                  );
                }}
              </Show>
              <Show when={currentImageRef()}>
                <button
                  onClick={() => setImageModalOpen(true)}
                  class="mt-1.5 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  画像を変更
                </button>
              </Show>
            </div>
          </div>

          {/* 下部固定ボタン */}
          <div class="px-5 py-4 border-t border-zinc-100 space-y-2">
            <Show when={isAdding()}>
              <Button variant="primary" class="w-full justify-center" onClick={handleCreate}>
                ピンを追加
              </Button>
            </Show>
            <Show when={!isAdding()}>
              <Button variant="primary" class="w-full justify-center" onClick={handleUpdate}>
                保存
              </Button>
              <Button variant="danger" class="w-full justify-center" onClick={handleDelete}>
                <TrashSvg />
                削除
              </Button>
            </Show>
          </div>
        </div>
      </Show>

      {/* ライトボックス */}
      <Show when={lightboxUrl()}>
        <Lightbox src={lightboxUrl()!} onClose={() => setLightboxUrl(null)} />
      </Show>

      {/* 画像選択モーダル */}
      <Show when={imageModalOpen()}>
        <div
          class="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setImageModalOpen(false); }}
        >
          <div class="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[70vh] flex flex-col">
            <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 class="font-semibold text-zinc-900">画像を選択</h3>
              <button
                onClick={() => setImageModalOpen(false)}
                class="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <XIcon />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 p-5">
              <Show
                when={allLoadedImages().length > 0}
                fallback={
                  <div class="flex flex-col items-center justify-center py-12 text-center">
                    <ImageIcon size={32} class="text-zinc-300 mb-3" />
                    <p class="text-sm text-zinc-500">読み込み済みの画像がありません</p>
                    <p class="text-xs text-zinc-400 mt-1">
                      ファイル管理画面でディレクトリを開いてください
                    </p>
                  </div>
                }
              >
                <ImageGrid
                  images={allLoadedImages()}
                  selectedUuid={currentImageRef()?.uuid}
                  onSelect={(ref) => {
                    setCurrentImageRef(ref);
                    setImageModalOpen(false);
                  }}
                />
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

function TrashSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2.5 4h11M6 4V2.5h4V4M12.5 4l-.7 9a1 1 0 0 1-1 .95H5.2a1 1 0 0 1-1-.95L3.5 4"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ThumbnailImg(props: { img: DbImage }) {
  const SIZES = ["small", "medium", "original"] as const;
  const [sizeIdx, setSizeIdx] = createSignal(0);
  const url = () => {
    const size = SIZES[sizeIdx()];
    if (!size) return null;
    return getPublicImageUrl(props.img.uuid, size);
  };
  return (
    <Show
      when={url()}
      fallback={
        <div class="w-full aspect-square bg-zinc-100 rounded mb-1 flex items-center justify-center text-zinc-400">
          <ImageIcon />
        </div>
      }
    >
      <img
        src={url()!}
        alt={props.img.name}
        class="w-full aspect-square object-cover rounded mb-1"
        loading="lazy"
        onError={() => setSizeIdx((i) => i + 1)}
      />
    </Show>
  );
}

function ImageGrid(props: {
  images: Array<{ dirName: string; img: DbImage }>;
  selectedUuid: string | undefined;
  onSelect: (ref: ImageRef) => void;
}) {
  const grouped = (): Array<[string, DbImage[]]> => {
    const map = new Map<string, DbImage[]>();
    for (const { dirName, img } of props.images) {
      if (!map.has(dirName)) map.set(dirName, []);
      map.get(dirName)!.push(img);
    }
    return Array.from(map.entries());
  };

  return (
    <div class="space-y-5">
      <For each={grouped()}>
        {([dirName, imgs]) => (
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
              {dirName}
            </p>
            <div class="grid grid-cols-4 gap-2">
              <For each={imgs}>
                {(img) => (
                  <button
                    onClick={() => props.onSelect({ id: img.id, uuid: img.uuid })}
                    class={`rounded-lg overflow-hidden border-2 transition-colors ${
                      props.selectedUuid === img.uuid
                        ? "border-indigo-500"
                        : "border-transparent hover:border-zinc-300"
                    }`}
                    title={img.name}
                  >
                    <ThumbnailImg img={img} />
                    <p class="px-1 pb-1 text-[10px] truncate text-zinc-500">{img.name}</p>
                  </button>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
