import { createSignal, Show } from "solid-js";
import { getManifest, updateBlogName, updateBlogTopImage, saveBlogConfig } from "../store/manifest";
import { getImageByUuid } from "../store/files";
import { getPublicImageUrl } from "../lib/s3";
import { Card, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { ImageIcon, XIcon } from "../components/icons";
import FilePicker from "../components/FilePicker";

export default function BlogSettingsPage() {
  const [showFilePicker, setShowFilePicker] = createSignal(false);

  const blogName = () => getManifest()?.blog?.name ?? "";
  const topImageUuid = () => getManifest()?.blog?.top_image_uuid ?? null;
  const topImageUrl = () => {
    const uuid = topImageUuid();
    if (!uuid) return null;
    return getPublicImageUrl(uuid, "medium");
  };

  async function handleSetTopImage(uuid: string) {
    const img = getImageByUuid(uuid);
    await updateBlogTopImage(img?.id ?? null, uuid);
    setShowFilePicker(false);
  }

  async function handleClearTopImage() {
    await updateBlogTopImage(null, null);
  }

  return (
    <>
      <div class="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200 shadow-sm">
        <div class="max-w-2xl mx-auto px-8 py-2.5">
          <PageHeader title="ブログ設定" class="mb-0" />
        </div>
      </div>
      <div class="max-w-2xl mx-auto px-8 py-8">
        <Card class="mb-6">
          <CardHeader>
            <p class="text-xs font-semibold uppercase tracking-widest text-zinc-500">基本情報</p>
          </CardHeader>
          <div class="p-5 space-y-5">
            {/* ブログ名 */}
            <Input
              label="ブログ名"
              value={blogName()}
              onInput={(e: Event) => {
                updateBlogName((e.currentTarget as HTMLInputElement).value);
              }}
              placeholder="山行記録"
            />
            <div class="flex justify-end">
              <Button variant="primary" onClick={() => saveBlogConfig().catch(console.error)}>
                保存
              </Button>
            </div>

            {/* トップページ画像 */}
            <div>
              <p class="text-sm font-medium text-zinc-700 mb-2">トップページ画像</p>
              <Show
                when={topImageUuid()}
                fallback={
                  <button
                    class="w-full h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-300 rounded-xl text-zinc-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                    onClick={() => setShowFilePicker(true)}
                  >
                    <ImageIcon size={28} />
                    <span class="text-sm">画像を選択</span>
                  </button>
                }
              >
                <div class="relative rounded-xl overflow-hidden border border-zinc-200">
                  <Show
                    when={topImageUrl()}
                    fallback={
                      <div class="h-32 bg-zinc-100 flex items-center justify-center">
                        <span class="font-mono text-xs text-zinc-500">{topImageUuid()}</span>
                      </div>
                    }
                  >
                    <img
                      src={topImageUrl()!}
                      class="w-full h-40 object-cover"
                      alt="トップページ画像"
                    />
                  </Show>
                  <div class="absolute top-2 right-2 flex gap-1.5">
                    <button
                      class="bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-lg px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-white shadow-sm"
                      onClick={() => setShowFilePicker(true)}
                    >
                      変更
                    </button>
                    <button
                      class="bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-lg p-1 text-red-500 hover:bg-white shadow-sm"
                      onClick={handleClearTopImage}
                      title="削除"
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Card>

        <Show when={showFilePicker()}>
          <FilePicker
            kind="image"
            onSelect={handleSetTopImage}
            onClose={() => setShowFilePicker(false)}
          />
        </Show>
      </div>
    </>
  );
}
