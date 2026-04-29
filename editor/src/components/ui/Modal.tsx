import type { JSX } from "solid-js";
import { Show } from "solid-js";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: string;
  children: JSX.Element;
}

export function Modal(props: Props) {
  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div
          class={`relative bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] w-full ${props.maxWidth ?? "max-w-lg"}`}
        >
          {props.title && (
            <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 class="text-base font-semibold text-zinc-900">{props.title}</h2>
              <button
                onClick={props.onClose}
                class="text-zinc-400 hover:text-zinc-600 transition-colors rounded-lg p-1 hover:bg-zinc-100"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          )}
          <div class="flex-1 overflow-y-auto">{props.children}</div>
        </div>
      </div>
    </Show>
  );
}
