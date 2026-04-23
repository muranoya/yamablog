interface Props {
  fileId: string;
  description: string;
  onDescriptionChange: (desc: string) => void;
}

export default function ImageBlock(props: Props) {
  return (
    <div class="border border-gray-200 rounded-lg p-3 bg-white">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">画像</span>
        <span class="text-xs text-gray-400 font-mono">{props.fileId}</span>
      </div>
      <input
        type="text"
        placeholder="キャプション（Markdown可）"
        class="w-full text-sm border border-gray-200 rounded p-2"
        value={props.description}
        onInput={(e) => props.onDescriptionChange(e.currentTarget.value)}
      />
    </div>
  );
}
