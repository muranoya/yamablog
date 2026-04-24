import { createSignal } from "solid-js";
import { importDataFolder, readJsonFile } from "../lib/importer";
import { setManifest, type ManifestData } from "../store/manifest";
import { setArticleFileMap } from "../store/article";
import { setFileEntryFileMap } from "../store/files";

interface Props {
  onImported: () => void;
}

export default function ImportPage(props: Props) {
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const imported = await importDataFolder(input.files);
      const manifest = await readJsonFile<ManifestData>(imported.manifest);
      setManifest(manifest);
      setArticleFileMap(imported.articles);
      setFileEntryFileMap(imported.fileEntries);
      props.onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="flex min-h-screen items-center justify-center bg-gray-50">
      <div class="rounded-xl bg-white p-8 shadow-md text-center max-w-md w-full">
        <h1 class="text-2xl font-bold mb-2">yamablog editor</h1>
        <p class="text-gray-500 mb-6 text-sm">
          <code class="bg-gray-100 px-1 rounded">data/</code> フォルダを選択してください
        </p>
        <label class="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          {loading() ? "読み込み中..." : "data/ フォルダを選択"}
          <input
            type="file"
            class="hidden"
            // @ts-ignore webkitdirectory is non-standard
            webkitdirectory
            onChange={handleChange}
            disabled={loading()}
          />
        </label>
        {error() && (
          <p class="mt-4 text-red-600 text-sm">{error()}</p>
        )}
      </div>
    </div>
  );
}
