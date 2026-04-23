import { createMemo } from "solid-js";
import { getDirtyFiles } from "../store/dirty";
import { exportChangedFiles } from "../lib/exporter";

export default function ExportButton() {
  const dirtyCount = createMemo(() => getDirtyFiles().size);

  return (
    <button
      onClick={exportChangedFiles}
      disabled={dirtyCount() === 0}
      class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
    >
      エクスポート
      {dirtyCount() > 0 && (
        <span class="bg-white text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
          {dirtyCount()}
        </span>
      )}
    </button>
  );
}
