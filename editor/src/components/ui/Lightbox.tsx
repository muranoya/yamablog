import { Show } from "solid-js";
import { XIcon } from "../icons";

interface Props {
  src: string;
  onClose: () => void;
}

export function Lightbox(props: Props) {
  return (
    <Show when={props.src}>
      <div
        class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <button
          class="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={(e) => { e.stopPropagation(); props.onClose(); }}
          title="閉じる"
        >
          <XIcon size={20} />
        </button>
        <img
          src={props.src}
          class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </Show>
  );
}
