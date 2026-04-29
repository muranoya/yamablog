import type { JSX } from "solid-js";

interface CardProps {
  class?: string;
  children: JSX.Element;
}

interface CardHeaderProps {
  class?: string;
  children: JSX.Element;
}

export function Card(props: CardProps) {
  return (
    <div
      class={`rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden ${props.class ?? ""}`}
    >
      {props.children}
    </div>
  );
}

export function CardHeader(props: CardHeaderProps) {
  return (
    <div class={`px-5 py-4 border-b border-zinc-100 ${props.class ?? ""}`}>
      {props.children}
    </div>
  );
}
