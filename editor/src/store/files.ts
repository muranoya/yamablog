import { createStore } from "solid-js/store";
import { markDirty } from "./dirty";

// File entry types
export interface ImageFile {
  id: string;
  kind: "image";
  name: string;
  sizes: {
    small: { width: number; height: number };
    medium: { width: number; height: number };
    original: { width: number; height: number };
  };
  shooting_datetime?: string;
  event_at: string;
}

export interface GpxFile {
  id: string;
  kind: "gpx";
  name: string;
  event_at: string;
  stats: {
    start_at?: string;
    end_at?: string;
    distance_m: number;
    cum_climb_m: number;
    cum_down_m: number;
    max_elevation_m: number;
    min_elevation_m: number;
  };
}

export type FileEntry = ImageFile | GpxFile;

type FilesStore = Record<string, FileEntry[]>;

const [filesStore, setFilesStore] = createStore<FilesStore>({});
const loadingDirs = new Set<string>();
let fileEntryFileMap = new Map<string, File>();

export function setFileEntryFileMap(map: Map<string, File>) {
  fileEntryFileMap = map;
}

export function getFileEntryFile(dirId: string): File | undefined {
  return fileEntryFileMap.get(dirId);
}

export function getDirectoryFiles(dirId: string): FileEntry[] | undefined {
  return filesStore[dirId];
}

export function setDirectoryFiles(dirId: string, files: FileEntry[]) {
  setFilesStore(dirId, files);
}

export function addFileEntry(dirId: string, entry: FileEntry) {
  setFilesStore(dirId, (prev) => [...(prev ?? []), entry]);
  markDirty(`files/${dirId}.json`);
}

export function isLoaded(dirId: string): boolean {
  return dirId in filesStore;
}

export function isLoading(dirId: string): boolean {
  return loadingDirs.has(dirId);
}

export function markLoading(dirId: string) {
  loadingDirs.add(dirId);
}

export function markLoadingDone(dirId: string) {
  loadingDirs.delete(dirId);
}
