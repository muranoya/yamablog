interface Props {
  fileId: string;
}

export default function GpxBlock(props: Props) {
  return (
    <div class="border border-blue-100 rounded-lg p-3 bg-blue-50">
      <span class="text-xs font-medium text-blue-600 uppercase tracking-wide">GPX</span>
      <p class="text-sm text-gray-700 mt-1 font-mono">{props.fileId}</p>
    </div>
  );
}
