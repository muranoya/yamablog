import { createSignal } from "solid-js";

interface Props {
  text: string;
  onChange: (text: string) => void;
}

export default function TextBlock(props: Props) {
  const [editing, setEditing] = createSignal(false);

  return (
    <div class="border border-gray-200 rounded-lg p-3 bg-white">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">テキスト</span>
        <button
          onClick={() => setEditing(!editing())}
          class="text-xs text-blue-600 hover:underline"
        >
          {editing() ? "完了" : "編集"}
        </button>
      </div>
      {editing() ? (
        <textarea
          class="w-full h-48 font-mono text-sm border border-gray-200 rounded p-2 resize-y"
          value={props.text}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      ) : (
        <pre class="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{props.text}</pre>
      )}
    </div>
  );
}
