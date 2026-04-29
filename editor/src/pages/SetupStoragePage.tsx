import { createSignal } from "solid-js";
import type { S3Config } from "../lib/crypto";
import { Input } from "../components/ui/Input";

interface Props {
  onNext: (config: S3Config) => void;
}

const FIELDS = [
  { key: "bucket" as const, label: "バケット名", type: "text", required: true, placeholder: "my-bucket" },
  { key: "accessKeyId" as const, label: "アクセスキーID", type: "text", required: true, placeholder: "" },
  { key: "secretAccessKey" as const, label: "シークレットアクセスキー", type: "password", required: true, placeholder: "" },
  { key: "publicUrl" as const, label: "公開URL", type: "text", optional: true, placeholder: "https://your-bucket.example.com", hint: "入力すると編集画面で画像プレビューが表示されます。未入力の場合、画像はアップロードできますがプレビューは表示されません。" },
];

export default function SetupStoragePage(props: Props) {
  const [config, setConfig] = createSignal<Partial<S3Config>>({});

  function isValid() {
    const c = config();
    return !!(c.bucket && c.accessKeyId && c.secretAccessKey);
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
          <span class="w-2 h-1 rounded-full bg-zinc-700" />
        </div>
      </div>

      <div class="flex-1 bg-white overflow-y-auto flex items-center justify-center p-12">
        <div class="w-full max-w-sm">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">
            01 / 03
          </p>
          <h1 class="text-2xl font-bold text-zinc-900 mb-1">ストレージ設定</h1>
          <p class="text-sm text-zinc-500 mb-8">
            S3の接続情報を入力してください
          </p>

          <div class="space-y-4">
            {FIELDS.map((field) => (
              <div>
                <Input
                  label={field.label}
                  type={field.type}
                  required={field.required}
                  optional={field.optional}
                  placeholder={field.placeholder}
                  value={(config() as any)[field.key] ?? ""}
                  onInput={(e: Event) =>
                    setConfig((prev) => ({
                      ...prev,
                      [field.key]: (e.currentTarget as HTMLInputElement).value,
                    }))
                  }
                  class="font-mono"
                />
                {field.hint && (
                  <p class="text-xs text-zinc-400 mt-1.5">{field.hint}</p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => { if (isValid()) props.onNext(config() as S3Config); }}
            disabled={!isValid()}
            class="mt-8 w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            次へ →
          </button>
        </div>
      </div>
    </div>
  );
}
