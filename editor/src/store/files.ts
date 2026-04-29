import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

export interface DbImage {
  id: number;
  uuid: string;
  name: string;
  small_width: number | null;
  small_height: number | null;
  medium_width: number | null;
  medium_height: number | null;
  original_width: number;
  original_height: number;
  shooting_datetime: number | null;
  created_at: number;
  updated_at: number;
}

type FilesStore = Record<string, DbImage[]>;

const [filesStore, setFilesStore] = createStore<FilesStore>({});
const loadingDirs = new Set<number>();

export function getDirectoryImages(dirId: number): DbImage[] | undefined {
  return filesStore[dirId.toString()];
}

// filesStore[key] への読み取りは Solid.js store が reactive に追跡するため、
// setFilesStore が呼ばれると <Show when={!isLoaded(...)}> が自動で再評価される
export function isLoaded(dirId: number): boolean {
  return filesStore[dirId.toString()] !== undefined;
}

export function isLoading(dirId: number): boolean {
  return loadingDirs.has(dirId);
}

export async function loadDirectoryImages(dirId: number): Promise<void> {
  if (isLoaded(dirId) || loadingDirs.has(dirId)) return;
  loadingDirs.add(dirId);
  try {
    const images = await invoke<DbImage[]>("db_get_directory_images", { directoryId: dirId });
    setFilesStore(dirId.toString(), images);
  } finally {
    loadingDirs.delete(dirId);
  }
}

export function setDirectoryImages(dirId: number, images: DbImage[]): void {
  setFilesStore(dirId.toString(), images);
}

export function getImageByUuid(uuid: string): DbImage | undefined {
  for (const key of Object.keys(filesStore)) {
    const img = filesStore[key]?.find((i) => i.uuid === uuid);
    if (img) return img;
  }
  return undefined;
}

export function getImageById(id: number): DbImage | undefined {
  for (const key of Object.keys(filesStore)) {
    const img = filesStore[key]?.find((i) => i.id === id);
    if (img) return img;
  }
  return undefined;
}

export async function addImage(
  dirId: number,
  input: Omit<DbImage, "id" | "created_at" | "updated_at">
): Promise<DbImage> {
  const now = Math.floor(Date.now() / 1000);
  const id = await invoke<number>("db_upsert_image", {
    input: {
      id: null,
      uuid: input.uuid,
      directory_id: dirId,
      name: input.name,
      small_width: input.small_width,
      small_height: input.small_height,
      medium_width: input.medium_width,
      medium_height: input.medium_height,
      original_width: input.original_width,
      original_height: input.original_height,
      shooting_datetime: input.shooting_datetime,
    },
  });
  const image: DbImage = { ...input, id, created_at: now, updated_at: now };
  setFilesStore(dirId.toString(), (prev) => [...(prev ?? []), image]);
  return image;
}

export async function deleteImage(dirId: number, imageId: number): Promise<void> {
  setFilesStore(dirId.toString(), (prev) => (prev ?? []).filter((i) => i.id !== imageId));
  await invoke("db_delete_image", { id: imageId });
}
