import { createSignal } from "solid-js";
import { loadR2Config, loadPublicConfig } from "../lib/crypto";
import { initR2Client } from "../lib/r2";
import { LockIcon } from "../components/icons";

interface Props {
  onUnlocked: () => void;
}

export default function UnlockPage(props: Props) {
  const [passphrase, setPassphrase] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [shake, setShake] = createSignal(false);

  async function handleUnlock() {
    if (!passphrase()) return;
    setLoading(true);
    setError(null);
    try {
      const config = await loadR2Config(passphrase());
      if (!config) {
        setError("パスフレーズが違います");
        setShake(true);
        setTimeout(() => setShake(false), 400);
        return;
      }
      // 設定画面で後から更新された publicUrl 等を平文設定からマージする
      initR2Client({ ...config, ...loadPublicConfig() });
      props.onUnlocked();
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
          <span class="w-2 h-1 rounded-full bg-zinc-700" />
          <span class="w-2 h-1 rounded-full bg-zinc-700" />
        </div>
      </div>

      <div class="flex-1 bg-white flex items-center justify-center p-12">
        <div class="w-full max-w-sm">
          <div class="flex justify-center mb-6">
            <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <LockIcon size={24} class="text-indigo-600" />
            </div>
          </div>

          <h1 class="text-2xl font-bold text-zinc-900 text-center mb-1">ロック解除</h1>
          <p class="text-sm text-zinc-500 text-center mb-8">
            パスフレーズを入力してください
          </p>

          <div class={shake() ? "animate-shake" : ""}>
            <input
              type="password"
              class={`w-full rounded-lg border px-3 py-3 text-center text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${error() ? "border-red-400" : "border-zinc-300"}`}
              placeholder="パスフレーズ"
              value={passphrase()}
              onInput={(e) => {
                setPassphrase(e.currentTarget.value);
                setError(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
              autofocus
            />
            {error() && (
              <p class="mt-2 text-xs text-red-600 text-center">{error()}</p>
            )}
          </div>

          <button
            onClick={handleUnlock}
            disabled={!passphrase() || loading()}
            class="mt-4 w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading() ? "確認中..." : "ロック解除"}
          </button>
        </div>
      </div>
    </div>
  );
}
