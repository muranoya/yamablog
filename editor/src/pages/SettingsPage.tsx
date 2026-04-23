import { createSignal, Show } from "solid-js";
import { hasStoredConfig, loadR2Config, saveR2Config, type R2Config } from "../lib/crypto";
import { initR2Client } from "../lib/r2";
import { getManifest, updateBlogName } from "../store/manifest";

export default function SettingsPage() {
  const [passphrase, setPassphrase] = createSignal("");
  const [config, setConfig] = createSignal<Partial<R2Config>>({});
  const [status, setStatus] = createSignal<"idle" | "saved" | "error">("idle");

  async function handleSave() {
    const cfg = config();
    if (!cfg.endpointUrl || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
      setStatus("error");
      return;
    }
    try {
      await saveR2Config(cfg as R2Config, passphrase());
      initR2Client(cfg as R2Config);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function handleLoad() {
    const cfg = await loadR2Config(passphrase());
    if (cfg) {
      setConfig(cfg);
      initR2Client(cfg);
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  return (
    <div class="max-w-lg mx-auto p-6 space-y-8">
      <section>
        <h2 class="text-lg font-bold mb-4">ブログ設定</h2>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ブログ名</label>
          <input
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={getManifest()?.blog.name ?? ""}
            onInput={(e) => updateBlogName(e.currentTarget.value)}
          />
        </div>
      </section>

      <section>
        <h2 class="text-lg font-bold mb-4">R2接続設定</h2>
        <div class="space-y-3">
          {(["endpointUrl", "bucket", "accessKeyId", "secretAccessKey"] as const).map((field) => (
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {field === "endpointUrl" ? "エンドポイントURL" :
                 field === "bucket" ? "バケット名" :
                 field === "accessKeyId" ? "アクセスキーID" : "シークレットアクセスキー"}
              </label>
              <input
                type={field === "secretAccessKey" ? "password" : "text"}
                class="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                value={(config() as any)[field] ?? ""}
                onInput={(e) => setConfig((prev) => ({ ...prev, [field]: e.currentTarget.value }))}
              />
            </div>
          ))}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">パスフレーズ</label>
            <input
              type="password"
              class="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={passphrase()}
              onInput={(e) => setPassphrase(e.currentTarget.value)}
            />
          </div>
          <div class="flex gap-2">
            <button onClick={handleSave} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              保存して接続
            </button>
            <Show when={hasStoredConfig()}>
              <button onClick={handleLoad} class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                保存済みを読み込む
              </button>
            </Show>
          </div>
          <Show when={status() === "saved"}>
            <p class="text-green-600 text-sm">✓ R2に接続済み</p>
          </Show>
          <Show when={status() === "error"}>
            <p class="text-red-600 text-sm">接続に失敗しました。設定を確認してください。</p>
          </Show>
        </div>
      </section>
    </div>
  );
}
