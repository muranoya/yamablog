interface Props {
  text: string;
  onChange: (text: string) => void;
}

export default function TextBlock(props: Props) {
  return (
    <div class="border-l-4 border-zinc-200 px-4 py-3">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
        テキスト
      </p>
      <textarea
        draggable={false}
        class="w-full min-h-[160px] font-mono text-sm text-zinc-700 bg-transparent border-none outline-none resize-y placeholder:text-zinc-300 focus:outline-none"
        value={props.text}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder="Markdownで入力..."
      />
    </div>
  );
}
