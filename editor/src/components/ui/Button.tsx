import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40",
  secondary:
    "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-40",
  ghost:
    "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-40",
  danger:
    "bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 disabled:opacity-40",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

export function Button(props: Props) {
  const [local, rest] = splitProps(props, ["variant", "size", "class", "children"]);
  const variant = () => local.variant ?? "secondary";
  const size = () => local.size ?? "md";

  return (
    <button
      class={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant()]} ${sizeClasses[size()]} ${local.class ?? ""}`}
      {...rest}
    >
      {local.children}
    </button>
  );
}
