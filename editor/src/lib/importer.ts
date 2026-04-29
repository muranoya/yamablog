import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { setAllData } from "../store/manifest";
import { setGpxEntries, setGpxFileMap, type GpxIndexItem } from "../store/gpx";
import { setOpenedDataDir } from "../store/path";
import { parseGpxStats } from "./gpx";

function joinPath(...parts: string[]): string {
  const sep = parts[0]?.includes("\\") ? "\\" : "/";
  return parts.join(sep);
}

export async function loadFromDataDir(dataDir: string): Promise<void> {
  const data = await invoke<{
    blog: {
      name: string;
      top_image_id: number | null;
      top_image_uuid: string | null;
      updated_at: number;
    };
    categories: Array<{
      id: number;
      slug: string;
      name: string;
      priority: number;
      created_at: number;
      updated_at: number;
    }>;
    directories: Array<{
      id: number;
      name: string;
      created_at: number;
      updated_at: number;
    }>;
    articles: Array<{
      id: number;
      slug: string;
      title: string;
      status: "published" | "draft";
      thumbnail_image_id: number | null;
      thumbnail_image_uuid: string | null;
      gpx_filename: string | null;
      created_at: number;
      updated_at: number;
      category_ids: number[];
    }>;
    map_memos: Array<{
      id: number;
      kind: number;
      lat: number;
      lng: number;
      memo: string;
      image_id: number | null;
      image_uuid: string | null;
      created_at: number;
      updated_at: number;
    }>;
  }>("db_get_all_data");

  setAllData(data);
  setOpenedDataDir(dataDir);

  const gpxDir = joinPath(dataDir, "gpx");
  const gpxPaths = new Map<string, string>();
  const entries: GpxIndexItem[] = [];

  try {
    const dirEntries = await readDir(gpxDir);
    for (const entry of dirEntries) {
      if (entry.name?.endsWith(".gpx")) {
        gpxPaths.set(entry.name, joinPath(gpxDir, entry.name));
      }
    }
    setGpxFileMap(gpxPaths);

    for (const [name, path] of gpxPaths) {
      try {
        const text = await invoke<string>("read_file", { path });
        const raw = parseGpxStats(text);
        entries.push({
          name,
          stats: {
            start_at: raw.start_at ? Math.floor(new Date(raw.start_at).getTime() / 1000) : undefined,
            end_at: raw.end_at ? Math.floor(new Date(raw.end_at).getTime() / 1000) : undefined,
            distance_m: raw.distance_m,
            cum_climb_m: raw.cum_climb_m,
            cum_down_m: raw.cum_down_m,
            max_elevation_m: raw.max_elevation_m,
            min_elevation_m: raw.min_elevation_m,
          },
        });
      } catch {
        entries.push({ name });
      }
    }
  } catch {
    // GPX directory may not exist yet
  }

  setGpxEntries(entries);
}
