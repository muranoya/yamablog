let gpxPathMap = new Map<string, string>();

export function setGpxFileMap(map: Map<string, string>) {
  gpxPathMap = map;
}

export function getGpxFile(name: string): string | undefined {
  return gpxPathMap.get(name);
}

export function addGpxPath(name: string, path: string): void {
  gpxPathMap.set(name, path);
}

export interface GpxStats {
  start_at?: number;
  end_at?: number;
  distance_m: number;
  cum_climb_m: number;
  cum_down_m: number;
  max_elevation_m: number;
  min_elevation_m: number;
}

export interface GpxIndexItem {
  name: string;
  stats?: GpxStats;
}

let gpxEntries: GpxIndexItem[] = [];

export function setGpxEntries(entries: GpxIndexItem[]) {
  gpxEntries = entries;
}

export function getGpxIndex(): GpxIndexItem[] {
  return gpxEntries;
}

export function getGpxEntry(name: string): GpxIndexItem | undefined {
  return gpxEntries.find((item) => item.name === name);
}

export function addGpxEntry(entry: GpxIndexItem) {
  gpxEntries = [...gpxEntries, entry];
}

export function removeGpxEntry(name: string) {
  gpxEntries = gpxEntries.filter((item) => item.name !== name);
  gpxPathMap.delete(name);
}
