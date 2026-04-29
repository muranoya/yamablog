import { Show } from "solid-js";
import GpxMapPreview from "../GpxMapPreview";
import { RouteIcon, PlusIcon } from "../icons";

interface Props {
  filename: string;
  onSelectFile: () => void;
}

export default function GpxBlock(props: Props) {
  return (
    <div class="p-3">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
        GPX
      </p>

      {/* ファイル選択ボタン行 */}
      <div class="flex items-center justify-end mb-2">
        <Show
          when={props.filename}
          fallback={
            <span class="text-xs text-zinc-400 italic flex-1">未選択</span>
          }
        >
          <span class="text-xs text-zinc-400 truncate flex-1">{props.filename}</span>
        </Show>
        <button
          onClick={props.onSelectFile}
          class="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors ml-2"
        >
          {props.filename ? <RouteIcon /> : <PlusIcon />}
          {props.filename ? "変更" : "GPXを選択"}
        </button>
      </div>

      {/* マップ＋統計 */}
      <GpxMapPreview filename={props.filename} mapHeightClass="h-56" />
    </div>
  );
}
