import { createSignal } from "solid-js";

const [dirtyPaths, setDirtyPaths] = createSignal<string[]>([]);

export function markDirty(path: string) {
  setDirtyPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
}

export function getDirtyFiles(): Set<string> {
  return new Set(dirtyPaths());
}

export function clearDirty() {
  setDirtyPaths([]);
}
