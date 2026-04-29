import { createMemo, createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { getPublicImageUrl } from "../../lib/r2";
import { getImageByUuid } from "../../store/files";
import { Lightbox } from "../ui/Lightbox";
import { ImageIcon, PencilIcon, EyeIcon } from "../icons";

interface Props {
  imageUuid: string | null;
  description: string;
  onDescriptionChange: (desc: string) => void;
  onSelectFile: () => void;
}

function formatShootingDatetime(unixSec: number | null): string | null {
  if (unixSec === null) return null;
  return new Date(unixSec * 1000).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ImageBlock(props: Props) {
  const [imgError, setImgError] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  const [lightboxUrl, setLightboxUrl] = createSignal<string | null>(null);

  const imageUrl = createMemo(() => {
    setImgError(false);
    if (!props.imageUuid) return null;
    return getPublicImageUrl(props.imageUuid, "medium");
  });

  const fallbackUrl = createMemo(() => {
    if (!props.imageUuid) return null;
    return getPublicImageUrl(props.imageUuid, "original");
  });

  const originalUrl = createMemo(() => {
    if (!props.imageUuid) return null;
    return getPublicImageUrl(props.imageUuid, "original");
  });

  const dbImage = createMemo(() => {
    if (!props.imageUuid) return null;
    return getImageByUuid(props.imageUuid) ?? null;
  });

  const shootingDatetime = createMemo(() => {
    const img = dbImage();
    return img ? formatShootingDatetime(img.shooting_datetime) : null;
  });

  const handleImgError: JSX.EventHandler<HTMLImageElement, Event> = (e) => {
    const fb = fallbackUrl();
    if (fb && e.currentTarget.src !== fb) {
      e.currentTarget.src = fb;
    } else {
      setImgError(true);
    }
  };

  function openLightbox(e: MouseEvent) {
    e.stopPropagation();
    const url = originalUrl() ?? imageUrl();
    if (url) setLightboxUrl(url);
  }

  return (
    <div class="p-3">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
        画像
      </p>

      <div
        class="relative rounded-lg overflow-hidden mb-2 bg-zinc-100"
        style="min-height: 120px"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Show
          when={props.imageUuid}
          fallback={
            <div
              class="flex flex-col items-center justify-center h-32 gap-2 text-zinc-400 hover:text-indigo-500 transition-colors cursor-pointer"
              onClick={props.onSelectFile}
            >
              <ImageIcon size={28} />
              <span class="text-xs">画像を選択</span>
            </div>
          }
        >
          <Show
            when={imageUrl() && !imgError()}
            fallback={
              <div class="flex items-center justify-center h-32 text-xs text-zinc-400">
                <Show when={!imageUrl()}>ストレージ公開URLが未設定です</Show>
                <Show when={imageUrl() && imgError()}>画像を読み込めませんでした</Show>
              </div>
            }
          >
            <img
              src={imageUrl()!}
              alt={props.description || ""}
              class="w-full object-cover max-h-72 cursor-zoom-in"
              onError={handleImgError}
              onClick={openLightbox}
            />
          </Show>

          <Show when={hovered()}>
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity pointer-events-none">
              <button
                class="pointer-events-auto bg-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); props.onSelectFile(); }}
              >
                <PencilIcon />
                画像を変更
              </button>
              <Show when={imageUrl() && !imgError()}>
                <button
                  class="pointer-events-auto bg-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                  onClick={openLightbox}
                >
                  <EyeIcon />
                  拡大
                </button>
              </Show>
            </div>
          </Show>
        </Show>
      </div>

      <Show when={shootingDatetime()}>
        <p class="text-[10px] text-zinc-400 mb-1.5 flex items-center gap-1">
          <span>撮影日時:</span>
          <span class="font-mono">{shootingDatetime()}</span>
        </p>
      </Show>

      <textarea
        rows={2}
        placeholder="キャプションを追加... (Markdown可)"
        class="w-full text-sm border-none bg-transparent text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300 rounded px-1 py-1 resize-y"
        value={props.description}
        onInput={(e) => props.onDescriptionChange(e.currentTarget.value)}
        onClick={(e) => e.stopPropagation()}
      />

      <Show when={lightboxUrl()}>
        <Lightbox src={lightboxUrl()!} onClose={() => setLightboxUrl(null)} />
      </Show>
    </div>
  );
}
