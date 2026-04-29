import type { JSX } from "solid-js";

type Variant = "published" | "draft" | "default";

interface Props {
  variant?: Variant;
  children: JSX.Element;
}

const classes: Record<Variant, string> = {
  published:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  draft:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  default:
    "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
};

const dotColors: Record<Variant, string> = {
  published: "bg-emerald-500",
  draft: "bg-amber-500",
  default: "bg-zinc-400",
};

export function Badge(props: Props) {
  const variant = () => props.variant ?? "default";
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant()]}`}
    >
      <span class={`w-1.5 h-1.5 rounded-full ${dotColors[variant()]}`} />
      {props.children}
    </span>
  );
}
