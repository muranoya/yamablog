import { createSignal, For, onMount, Show } from "solid-js";
import { getManifest } from "../store/manifest";
import {
  getDirectoryImages,
  isLoaded,
  loadDirectoryImages,
  addImage,
  deleteImage,
  type DbImage,
} from "../store/files";
import { processImage } from "../lib/image";
import { uploadImage, getSmallSrc, getMediumSrc, getOriginalSrc } from "../lib/r2";
import { Lightbox } from "../components/ui/Lightbox";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { ChevronLeftIcon, UploadIcon, TrashIcon, ImageIcon, XIcon, EyeIcon } from "../components/icons";

interface Props {
  dirId: number;
  onBack: () => void;
}

export default function FileListPage(props: Props) {
  const [uploading, setUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = createSignal<string | null>(null);
  let fileInputRef: HTMLInputElement | undefined;

  const dirName = () =>
    getManifest()?.directories.find((d) => d.id === props.dirId)?.name ?? String(props.dirId);

  onMount(async () => {
    if (!isLoaded(props.dirId)) {
      await loadDirectoryImages(props.dirId);
    }
  });

  const images = () => getDirectoryImages(props.dirId) ?? [];

  async function handleUpload(files: FileList) {
    setUploading(true);
    setUploadError(null);
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const processed = await processImage(file);
        const uuid = crypto.randomUUID();
        await uploadImage(uuid, processed);

        const shooting = processed.shootingDatetime
          ? Math.floor(new Date(processed.shootingDatetime).getTime() / 1000)
          : null;

        await addImage(props.dirId, {
          uuid,
          name: file.name,
          small_width: processed.smallSize?.width ?? null,
          small_height: processed.smallSize?.height ?? null,
          medium_width: processed.mediumSize?.width ?? null,
          medium_height: processed.mediumSize?.height ?? null,
          original_width: processed.originalSize.width,
          original_height: processed.originalSize.height,
          shooting_datetime: shooting,
        });
      } catch {
        errors.push(file.name);
      }
    }

    setUploading(false);
    if (errors.length > 0) {
      setUploadError(`アップロード失敗: ${errors.join(", ")}`);
    }
  }

  async function handleDelete(img: DbImage) {
    if (!window.confirm(`「${img.name}」を削除しますか？`)) return;
    await deleteImage(props.dirId, img.id);
  }

  return (
    <div class="max-w-4xl mx-auto px-8 py-8">
      <div class="flex items-center gap-2 mb-2 text-sm text-zinc-500">
        <button
          class="flex items-center gap-1 hover:text-zinc-900 transition-colors"
          onClick={props.onBack}
        >
          <ChevronLeftIcon />
          ディレクトリ
        </button>
        <span>/</span>
        <span class="text-zinc-900 font-medium">{dirName()}</span>
      </div>

      <PageHeader
        title={dirName()}
        action={
          <Button
            variant="primary"
            size="sm"
            disabled={uploading()}
            onClick={() => fileInputRef?.click()}
          >
            <UploadIcon />
            {uploading() ? "アップロード中..." : "アップロード"}
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        class="hidden"
        onChange={(e) => {
          if (e.currentTarget.files?.length) handleUpload(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />

      {uploadError() && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
          <span>{uploadError()}</span>
          <button onClick={() => setUploadError(null)} class="text-red-400 hover:text-red-600">
            <XIcon />
          </button>
        </div>
      )}

      <Show when={lightboxUrl()}>
        <Lightbox src={lightboxUrl()!} onClose={() => setLightboxUrl(null)} />
      </Show>

      <Show
        when={!isLoaded(props.dirId)}
        fallback={
          <Show
            when={images().length > 0}
            fallback={
              <EmptyState
                icon={<ImageIcon size={24} />}
                title="画像がありません"
                description="画像ファイルをアップロードしてください"
                action={
                  <Button variant="primary" size="sm" onClick={() => fileInputRef?.click()}>
                    <UploadIcon />
                    最初の画像をアップロード
                  </Button>
                }
              />
            }
          >
            <div class="grid grid-cols-4 gap-3 lg:grid-cols-6">
              <For each={images()}>
                {(img) => {
                  const [hovered, setHovered] = createSignal(false);
                  const smallUrl = () => getSmallSrc(img);
                  const mediumUrl = () => getMediumSrc(img);
                  const originalUrl = () => getOriginalSrc(img);
                  return (
                    <div
                      class="relative rounded-xl overflow-hidden bg-zinc-100 aspect-square group cursor-pointer"
                      onMouseEnter={() => setHovered(true)}
                      onMouseLeave={() => setHovered(false)}
                      onClick={() => {
                        const url = originalUrl() ?? mediumUrl() ?? smallUrl();
                        if (url) setLightboxUrl(url);
                      }}
                    >
                      <Show
                        when={smallUrl()}
                        fallback={
                          <div class="w-full h-full flex items-center justify-center text-zinc-400">
                            <ImageIcon size={20} />
                          </div>
                        }
                      >
                        <img src={smallUrl()!} alt={img.name} class="w-full h-full object-cover" />
                      </Show>

                      <Show when={hovered()}>
                        <div class="absolute inset-0 bg-black/40 flex items-end p-2 gap-1.5">
                          <button
                            class="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = originalUrl() ?? mediumUrl() ?? smallUrl();
                              if (url) setLightboxUrl(url);
                            }}
                            title="拡大"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            class="ml-auto bg-red-500 hover:bg-red-600 text-white rounded-lg p-1.5 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                            title="削除"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        }
      >
        <div class="flex items-center justify-center py-16">
          <p class="text-sm text-zinc-400">読み込み中...</p>
        </div>
      </Show>
    </div>
  );
}
