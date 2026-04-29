import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import L from "leaflet";
import { getGpxFile, getGpxEntry } from "../store/gpx";
import { parseGpxPolyline } from "../lib/gpx";
import { RouteIcon } from "./icons";

interface Props {
  filename: string;
  mapHeightClass?: string;
}

export default function GpxMapPreview(props: Props) {
  let mapRef: HTMLDivElement | undefined;
  let mapInstance: L.Map | null = null;
  let polyline: L.Polyline | null = null;

  const gpxEntry = createMemo(() => {
    if (!props.filename) return undefined;
    return getGpxEntry(props.filename);
  });

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
    if (!mapInstance) return;
    if (polyline) { polyline.remove(); polyline = null; }
    if (!props.filename) return;
    const path = getGpxFile(props.filename);
    if (!path) return;
    try {
      const xml = await invoke<string>("read_file", { path });
      const points = parseGpxPolyline(xml);
      if (points.length === 0) return;
      polyline = L.polyline(points, { color: "#1d5c3e", weight: 3 }).addTo(mapInstance!);
      mapInstance!.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } catch (e) {
      console.error("GPX読み込みエラー:", e);
    }
  });

  return (
    <div>
      {/* 統計バー */}
      <Show when={props.filename}>
        <Show when={gpxEntry()?.stats} fallback={
          <p class="font-mono text-xs text-zinc-400 mb-2 truncate">{props.filename}</p>
        }>
          <div class="flex items-center gap-1.5 flex-wrap mb-2">
            <span class="flex items-center gap-1 bg-zinc-100 text-zinc-600 text-xs px-2 py-1 rounded-full">
              <RouteIcon class="text-emerald-600" />
              {(gpxEntry()!.stats!.distance_m / 1000).toFixed(1)} km
            </span>
            <Show when={gpxEntry()!.stats!.cum_climb_m}>
              <span class="bg-zinc-100 text-zinc-600 text-xs px-2 py-1 rounded-full">
                ↑ {gpxEntry()!.stats!.cum_climb_m} m
              </span>
            </Show>
            <Show when={gpxEntry()!.stats!.start_at}>
              <span class="bg-zinc-100 text-zinc-600 text-xs px-2 py-1 rounded-full">
                {new Date(gpxEntry()!.stats!.start_at! * 1000).toISOString().substring(0, 10)}
              </span>
            </Show>
          </div>
        </Show>
      </Show>

      {/* Leaflet マップ */}
      <div style="isolation: isolate">
        <div
          ref={mapRef}
          class={`${props.mapHeightClass ?? "h-44"} w-full rounded-lg overflow-hidden border border-zinc-100`}
        />
      </div>
    </div>
  );
}
