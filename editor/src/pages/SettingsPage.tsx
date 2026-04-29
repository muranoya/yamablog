import { createSignal } from "solid-js";
import {
  hasStoredConfig, loadR2Config, saveR2Config,
  loadPublicConfig, savePublicConfig, clearR2Config, clearLastDataDir,
  type R2Config
} from "../lib/crypto";
import { initR2Client, getCurrentR2Config } from "../lib/r2";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";

export default function SettingsPage() {
  // 非機密フィールド — plaintext から即座に読み込む
  const [pubConfig, setPubConfig] = createSignal<Partial<R2Config>>(loadPublicConfig());
  const [pubSaveStatus, setPubSaveStatus] = createSignal<"idle" | "saved">("idle");

  // シークレットアクセスキー更新
  const [newSecret, setNewSecret] = createSignal("");
  const [secretPassphrase, setSecretPassphrase] = createSignal("");
  const [secretStatus, setSecretStatus] = createSignal<"idle" | "saved" | "error">("idle");

  // パスフレーズ変更
  const [currentPass, setCurrentPass] = createSignal("");
  const [newPass, setNewPass] = createSignal("");
  const [confirmPass, setConfirmPass] = createSignal("");
  const [passChangeStatus, setPassChangeStatus] = createSignal<"idle" | "success" | "error">("idle");
  const [passChangeError, setPassChangeError] = createSignal<string | null>(null);

  function handleSavePublic() {
    const cfg = pubConfig();
    savePublicConfig(cfg);
    // アンロック済みの場合、インメモリのシークレットを使って R2 クライアントを再初期化
    const current = getCurrentR2Config();
    if (current) {
      initR2Client({ ...current, ...cfg });
    }
    setPubSaveStatus("saved");
    setTimeout(() => setPubSaveStatus("idle"), 3000);
  }

  async function handleUpdateSecret() {
    if (!newSecret() || !secretPassphrase()) {
      setSecretStatus("error");
      return;
    }
    const existing = await loadR2Config(secretPassphrase());
    if (!existing) {
      setSecretStatus("error");
      return;
    }
    const merged: R2Config = { ...existing, ...pubConfig(), secretAccessKey: newSecret() };
    await saveR2Config(merged, secretPassphrase());
    initR2Client(merged);
    setSecretStatus("saved");
    setNewSecret("");
    setSecretPassphrase("");
  }

  async function handleChangePassphrase() {
    setPassChangeError(null);
    if (!currentPass()) { setPassChangeError("現在のパスフレーズを入力してください"); return; }
    if (!newPass()) { setPassChangeError("新しいパスフレーズを入力してください"); return; }
    if (newPass() !== confirmPass()) { setPassChangeError("新しいパスフレーズが一致しません"); return; }

    const cfg = await loadR2Config(currentPass());
    if (!cfg) { setPassChangeError("現在のパスフレーズが違います"); return; }

    try {
      await saveR2Config(cfg, newPass());
      initR2Client(cfg);
      setPassChangeStatus("success");
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
    } catch {
      setPassChangeError("変更に失敗しました");
    }
  }

  function handleDeleteConfig() {
    if (!window.confirm("ストレージ設定を削除しますか？\nアプリがリセットされます。")) return;
    clearR2Config();
    clearLastDataDir();
    window.location.reload();
  }

  const PUBLIC_FIELDS = [
    { key: "endpointUrl" as const, label: "エンドポイントURL", optional: true, placeholder: "" },
    { key: "bucket" as const, label: "バケット名", optional: false, placeholder: "my-bucket" },
    { key: "accessKeyId" as const, label: "アクセスキーID", optional: false, placeholder: "" },
    { key: "publicUrl" as const, label: "公開URL", optional: true, placeholder: "https://your-bucket.example.com" },
  ];

  return (
    <>
      <div class="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200 shadow-sm">
        <div class="max-w-2xl mx-auto px-8 py-2.5">
          <PageHeader title="設定" class="mb-0" />
        </div>
      </div>
      <div class="max-w-2xl mx-auto px-8 py-8 space-y-6">

        {/* 接続設定（非機密） */}
        <Card>
          <CardHeader>
            <p class="text-xs font-semibold uppercase tracking-widest text-zinc-500">接続設定</p>
          </CardHeader>
          <div class="p-5 space-y-4">
            {PUBLIC_FIELDS.map((field) => (
              <Input
                label={field.label}
                type="text"
                optional={field.optional}
                required={!field.optional}
                placeholder={field.placeholder}
                value={(pubConfig() as any)[field.key] ?? ""}
                onInput={(e: Event) =>
                  setPubConfig((prev) => ({ ...prev, [field.key]: (e.currentTarget as HTMLInputElement).value }))
                }
                class="font-mono"
              />
            ))}
            <div class="flex items-center gap-3 pt-1">
              <Button variant="primary" onClick={handleSavePublic}>保存</Button>
              {pubSaveStatus() === "saved" && (
                <p class="text-sm text-emerald-600">✓ 保存しました</p>
              )}
            </div>
          </div>
        </Card>

        {/* シークレットアクセスキー更新 */}
        <Card>
          <CardHeader>
            <p class="text-xs font-semibold uppercase tracking-widest text-zinc-500">シークレットアクセスキー</p>
          </CardHeader>
          <div class="p-5 space-y-3">
            <p class="text-xs text-zinc-500">更新する場合はパスフレーズとともに入力してください。</p>
            <Input
              label="新しいシークレットアクセスキー"
              type="password"
              value={newSecret()}
              onInput={(e: Event) => { setNewSecret((e.currentTarget as HTMLInputElement).value); setSecretStatus("idle"); }}
              class="font-mono"
            />
            <Input
              label="パスフレーズ"
              type="password"
              value={secretPassphrase()}
              onInput={(e: Event) => { setSecretPassphrase((e.currentTarget as HTMLInputElement).value); setSecretStatus("idle"); }}
            />
            <div class="flex items-center gap-3 pt-1">
              <Button variant="primary" onClick={handleUpdateSecret}>更新</Button>
              {secretStatus() === "saved" && (
                <p class="text-sm text-emerald-600">✓ 更新しました</p>
              )}
              {secretStatus() === "error" && (
                <p class="text-sm text-red-600">更新に失敗しました。パスフレーズを確認してください。</p>
              )}
            </div>
          </div>
        </Card>

        {/* パスフレーズ変更 */}
        <Card>
          <CardHeader>
            <p class="text-xs font-semibold uppercase tracking-widest text-zinc-500">パスフレーズ変更</p>
          </CardHeader>
          <div class="p-5 space-y-3">
            <Input
              label="現在のパスフレーズ"
              type="password"
              value={currentPass()}
              onInput={(e: Event) => { setCurrentPass((e.currentTarget as HTMLInputElement).value); setPassChangeStatus("idle"); }}
            />
            <Input
              label="新しいパスフレーズ"
              type="password"
              value={newPass()}
              onInput={(e: Event) => { setNewPass((e.currentTarget as HTMLInputElement).value); setPassChangeStatus("idle"); }}
            />
            <Input
              label="新しいパスフレーズ（確認）"
              type="password"
              value={confirmPass()}
              error={confirmPass().length > 0 && newPass() !== confirmPass() ? "パスフレーズが一致しません" : undefined}
              onInput={(e: Event) => { setConfirmPass((e.currentTarget as HTMLInputElement).value); setPassChangeStatus("idle"); }}
            />
            {passChangeError() && <p class="text-sm text-red-600">{passChangeError()}</p>}
            {passChangeStatus() === "success" && <p class="text-sm text-emerald-600">✓ パスフレーズを変更しました</p>}
            <Button variant="primary" onClick={handleChangePassphrase}>パスフレーズを変更</Button>
          </div>
        </Card>

        {/* 危険な操作 */}
        <div class="border border-red-200 rounded-xl overflow-hidden">
          <div class="px-5 py-4 bg-red-50 border-b border-red-200">
            <p class="text-xs font-semibold uppercase tracking-widest text-red-500">危険な操作</p>
          </div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-zinc-900">ストレージ設定を削除</p>
                <p class="text-xs text-zinc-500 mt-0.5">
                  設定を削除するとアプリがリセットされ、再セットアップが必要になります
                </p>
              </div>
              <Button variant="danger" onClick={handleDeleteConfig}>削除</Button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
