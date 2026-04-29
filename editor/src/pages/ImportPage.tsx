import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { saveLastDataDir } from "../lib/crypto";
import { FolderIcon } from "../components/icons";

interface Props {
  onSelected: (dataDir: string) => void;
}

export default function ImportPage(props: Props) {
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function handleSelectDir() {
    setLoading(true);
    setError(null);
    try {
      const dataDir = await invoke<string | null>("open_data_dir_dialog");
      if (!dataDir) return;
      saveLastDataDir(dataDir);
      props.onSelected(dataDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データディレクトリを開けませんでした");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="flex h-screen">
      <div class="w-80 bg-zinc-900 flex flex-col justify-between p-8 shrink-0">
        <div>
          <span class="text-sm font-semibold text-white tracking-wider">yamablog</span>
          <p class="text-xs text-zinc-500 mt-0.5">editor</p>
        </div>
        <div>
          <h2 class="text-2xl font-bold text-white leading-tight">
            山の記録を<br />続けよう。
          </h2>
          <p class="text-zinc-400 text-sm mt-3">
            GPX軌跡・写真・テキストで<br />あなたの山行を記録するエディタ
          </p>
        </div>
        <div class="flex gap-1">
          <span class="w-8 h-1 rounded-full bg-indigo-500" />
          <span class="w-8 h-1 rounded-full bg-indigo-500" />
          <span class="w-8 h-1 rounded-full bg-indigo-500" />
        </div>
      </div>

      <div class="flex-1 bg-white flex items-center justify-center p-12">
        <div class="w-full max-w-sm text-center">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">
            03 / 03
          </p>
          <h1 class="text-2xl font-bold text-zinc-900 mb-1">データディレクトリ選択</h1>
          <p class="text-sm text-zinc-500 mb-10">
            <code class="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700 font-mono">data/</code>{" "}
            ディレクトリを選択してください
          </p>

          <button
            onClick={handleSelectDir}
            disabled={loading()}
            class="w-full flex flex-col items-center justify-center gap-4 border-2 border-dashed border-zinc-300 rounded-2xl p-12 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div class="w-14 h-14 rounded-2xl bg-zinc-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
              <FolderIcon size={28} class="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            <div>
              <p class="text-sm font-medium text-zinc-700 group-hover:text-indigo-700 transition-colors">
                {loading() ? "読み込み中..." : "クリックしてフォルダを選択"}
              </p>
              <p class="text-xs text-zinc-400 mt-0.5">blog.sqlite3 を含む data/ フォルダ</p>
            </div>
          </button>

          {error() && (
            <p class="mt-4 text-sm text-red-600">{error()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
