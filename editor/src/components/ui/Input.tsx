import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

interface Props extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
}

export function Input(props: Props) {
  const [local, rest] = splitProps(props, [
    "label",
    "hint",
    "error",
    "required",
    "optional",
    "class",
  ]);

  return (
    <div class="space-y-1.5">
      {local.label && (
        <label class="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
          {local.label}
          {local.required && <span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
          {local.optional && (
            <span class="text-xs font-normal text-zinc-400">(任意)</span>
          )}
        </label>
      )}
      <input
        class={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:bg-zinc-50 disabled:text-zinc-500 ${local.error ? "border-red-400 focus:ring-red-500" : ""} ${local.class ?? ""}`}
        {...rest}
      />
      {local.error && (
        <p class="text-xs text-red-600">{local.error}</p>
      )}
      {local.hint && !local.error && (
        <p class="text-xs text-zinc-400">{local.hint}</p>
      )}
    </div>
  );
}
