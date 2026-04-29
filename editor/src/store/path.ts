import { createSignal } from "solid-js";

const [dataDir, setDataDir] = createSignal<string | null>(null);

export function getDataDir(): string | null {
  return dataDir();
}

export function setOpenedDataDir(dir: string) {
  setDataDir(dir);
}
