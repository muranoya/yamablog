import { createSignal } from "solid-js";
import { saveS3Config, type S3Config } from "../lib/crypto";
import { initS3Client } from "../lib/s3";
import { Input } from "../components/ui/Input";

interface Props {
  config: S3Config;
  onDone: () => void;
}

export default function SetupPasswordPage(props: Props) {
  const [passphrase, setPassphrase] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const strength = () => {
    const p = passphrase();
    if (!p) return 0;
    if (p.length < 6) return 1;
    if (p.length < 10) return 2;
    return 3;
  };

  const strengthLabel = () => ["", "弱い", "普通", "強い"][strength()];
  const strengthColor = () => ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"][strength()];

  function isValid() {
    return passphrase().length > 0 && passphrase() === confirm();
  }

  async function handleSubmit() {
    if (!isValid()) return;
    setLoading(true);
    setError(null);
    try {
      await saveS3Config(props.config, passphrase());
      initS3Client(props.config);
      props.onDone();
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
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
        <div class="w-full max-w-sm">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">
            02 / 03
          </p>
          <h1 class="text-2xl font-bold text-zinc-900 mb-1">パスフレーズ設定</h1>
          <p class="text-sm text-zinc-500 mb-8">
            ストレージ設定を暗号化します。次回起動時に入力が必要です。
          </p>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <Input
                label="パスフレーズ"
                type="password"
                required
                value={passphrase()}
                onInput={(e: Event) => setPassphrase((e.currentTarget as HTMLInputElement).value)}
              />
              {passphrase().length > 0 && (
                <div class="flex items-center gap-2">
                  <div class="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <span
                        class={`h-1 w-8 rounded-full transition-colors ${i <= strength() ? strengthColor() : "bg-zinc-200"}`}
                      />
                    ))}
                  </div>
                  <span class="text-xs text-zinc-500">{strengthLabel()}</span>
                </div>
              )}
            </div>

            <Input
              label="パスフレーズ（確認）"
              type="password"
              required
              value={confirm()}
              error={confirm().length > 0 && passphrase() !== confirm() ? "パスフレーズが一致しません" : undefined}
              onInput={(e: Event) => setConfirm((e.currentTarget as HTMLInputElement).value)}
            />
          </div>

          {error() && <p class="mt-3 text-sm text-red-600">{error()}</p>}

          <button
            onClick={handleSubmit}
            disabled={!isValid() || loading()}
            class="mt-8 w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading() ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
