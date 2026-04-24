import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import L from "leaflet";
import { getManifest, addMapMemo, updateMapMemo, deleteMapMemo } from "../store/manifest";
import { MAP_MEMO_KINDS, createMarkerIcon } from "../lib/leafletIconHelper";

type MapMemo = NonNullable<ReturnType<typeof getManifest>>["map_memos"][number];

interface PendingLatLng {
  lat: number;
  lng: number;
}

export default function MapMemoPage() {
  let mapRef: HTMLDivElement | undefined;
  let mapInstance: L.Map | null = null;
  const markerMap = new Map<string, L.Marker>();
  let pendingMarker: L.Marker | null = null;

  const [panelOpen, setPanelOpen] = createSignal(false);
  const [pendingLatLng, setPendingLatLng] = createSignal<PendingLatLng | null>(null);
  const [selectedMemo, setSelectedMemo] = createSignal<MapMemo | null>(null);

  const [newKind, setNewKind] = createSignal(0);
  const [newMemo, setNewMemo] = createSignal("");
  const [editKind, setEditKind] = createSignal(0);
  const [editMemo, setEditMemo] = createSignal("");

  function round7(v: number): number {
    return Math.round(v * 1e7) / 1e7;
  }

  function addMarkerForMemo(memo: MapMemo) {
    if (!mapInstance) return;
    const icon = createMarkerIcon(memo.kind);
    const marker = L.marker([memo.lat, memo.lng], { icon }).addTo(mapInstance);
    marker.on("click", () => {
      setPendingLatLng(null);
      clearPendingMarker();
      setSelectedMemo(memo);
      setEditKind(memo.kind);
      setEditMemo(memo.memo);
      setPanelOpen(true);
    });
    markerMap.set(memo.id, marker);
  }

  function clearPendingMarker() {
    if (pendingMarker) {
      pendingMarker.remove();
      pendingMarker = null;
    }
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

    // 既存メモを全件描画
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
      setPanelOpen(true);

      // 仮マーカーを置く
      pendingMarker = L.marker([lat, lng], {
        icon: createMarkerIcon(0),
        opacity: 0.6,
      }).addTo(mapInstance!);
    });
  });

  onCleanup(() => {
    mapInstance?.remove();
    mapInstance = null;
  });

  function handleCreate() {
    const pos = pendingLatLng();
    if (!pos) return;
    const memo = { kind: newKind(), lat: pos.lat, lng: pos.lng, memo: newMemo() };
    addMapMemo(memo);

    // 保存したメモのマーカーを追加
    const memos = getManifest()?.map_memos ?? [];
    const saved = memos[memos.length - 1];
    if (saved) addMarkerForMemo(saved);

    clearPendingMarker();
    setPanelOpen(false);
    setPendingLatLng(null);
  }

  function handleUpdate() {
    const memo = selectedMemo();
    if (!memo) return;
    updateMapMemo(memo.id, { kind: editKind(), memo: editMemo() });

    // マーカーのアイコンを更新
    const marker = markerMap.get(memo.id);
    if (marker) marker.setIcon(createMarkerIcon(editKind()));

    // クリックハンドラを更新するためにマーカーを再作成
    marker?.remove();
    markerMap.delete(memo.id);
    const updated = getManifest()?.map_memos.find((m) => m.id === memo.id);
    if (updated) addMarkerForMemo(updated);

    setPanelOpen(false);
    setSelectedMemo(null);
  }

  function handleDelete() {
    const memo = selectedMemo();
    if (!memo) return;
    deleteMapMemo(memo.id);

    const marker = markerMap.get(memo.id);
    marker?.remove();
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

  return (
    <div class="relative flex h-full">
      <div ref={mapRef!} class="flex-1 min-h-0" />

      <Show when={panelOpen()}>
        <div class="w-72 bg-white border-l border-gray-200 shrink-0 overflow-y-auto flex flex-col">
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-semibold text-sm text-gray-700">
              {pendingLatLng() ? "メモを追加" : "メモを編集"}
            </h2>
            <button
              onClick={handleCancel}
              class="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div class="p-4 flex flex-col gap-4 flex-1">
            <Show when={pendingLatLng()}>
              {(pos) => (
                <p class="text-xs text-gray-400 font-mono">
                  {pos().lat.toFixed(6)}, {pos().lng.toFixed(6)}
                </p>
              )}
            </Show>
            <Show when={selectedMemo()}>
              {(memo) => (
                <p class="text-xs text-gray-400 font-mono">
                  {memo().lat.toFixed(6)}, {memo().lng.toFixed(6)}
                </p>
              )}
            </Show>

            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">種類</label>
              <select
                value={pendingLatLng() ? newKind() : editKind()}
                onChange={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (pendingLatLng()) {
                    setNewKind(v);
                    if (pendingMarker) pendingMarker.setIcon(createMarkerIcon(v));
                  } else {
                    setEditKind(v);
                  }
                }}
                class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <For each={MAP_MEMO_KINDS}>
                  {(k) => <option value={k.id}>{k.name}</option>}
                </For>
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">メモ</label>
              <textarea
                value={pendingLatLng() ? newMemo() : editMemo()}
                onInput={(e) => {
                  if (pendingLatLng()) setNewMemo(e.currentTarget.value);
                  else setEditMemo(e.currentTarget.value);
                }}
                rows={4}
                class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none"
                placeholder="メモを入力..."
              />
            </div>

            <Show when={pendingLatLng()}>
              <button
                onClick={handleCreate}
                class="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                追加
              </button>
            </Show>

            <Show when={selectedMemo()}>
              <div class="flex flex-col gap-2">
                <button
                  onClick={handleUpdate}
                  class="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  保存
                </button>
                <button
                  onClick={handleDelete}
                  class="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                >
                  削除
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!panelOpen()}>
        <div class="absolute bottom-4 right-4 bg-white rounded-lg shadow px-3 py-2 text-xs text-gray-500 pointer-events-none">
          地図をクリックしてメモを追加 · {getManifest()?.map_memos.length ?? 0} 件
        </div>
      </Show>
    </div>
  );
}

