import type { JSX } from "solid-js";
import { Show } from "solid-js";

interface Props {
  icon?: JSX.Element;
  title: string;
  description?: string;
  action?: JSX.Element;
}

export function EmptyState(props: Props) {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Show when={props.icon}>
        <div class="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4">
          {props.icon}
        </div>
      </Show>
      <h3 class="text-sm font-semibold text-zinc-900 mb-1">{props.title}</h3>
      <Show when={props.description}>
        <p class="text-sm text-zinc-500 max-w-xs mb-4">{props.description}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-2">{props.action}</div>
      </Show>
    </div>
  );
}
