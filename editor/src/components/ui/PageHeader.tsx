import type { JSX } from "solid-js";
import { Show } from "solid-js";

interface Props {
  title: string;
  subtitle?: string;
  action?: JSX.Element;
  class?: string;
}

export function PageHeader(props: Props) {
  return (
    <div class={`flex items-start justify-between ${props.class ?? "mb-6"}`}>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-zinc-900">{props.title}</h1>
        <Show when={props.subtitle}>
          <p class="text-sm text-zinc-500 mt-0.5">{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.action}>
        <div class="shrink-0 ml-4">{props.action}</div>
      </Show>
    </div>
  );
}
