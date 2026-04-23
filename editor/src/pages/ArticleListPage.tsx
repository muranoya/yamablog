import { createSignal, For, Show } from "solid-js";
import { getManifest } from "../store/manifest";
import ArticleEditPage from "./ArticleEditPage";

export default function ArticleListPage() {
  const [editingId, setEditingId] = createSignal<string | null>(null);

  const published = () =>
    (getManifest()?.articles ?? [])
      .filter((a) => a.status === "published")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const drafts = () =>
    (getManifest()?.articles ?? [])
      .filter((a) => a.status === "draft")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <Show when={!editingId()} fallback={<ArticleEditPage id={editingId()!} onBack={() => setEditingId(null)} />}>
      <div class="max-w-3xl mx-auto p-6">
        <h1 class="text-2xl font-bold mb-6">記事一覧</h1>
        <section class="mb-8">
          <h2 class="text-lg font-semibold mb-3 text-gray-700">公開済み</h2>
          <ul class="space-y-2">
            <For each={published()}>
              {(article) => (
                <li class="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm">
                  <span class="font-medium">{article.title}</span>
                  <div class="flex gap-2 items-center">
                    <time class="text-sm text-gray-400">{article.updated_at}</time>
                    <button
                      onClick={() => setEditingId(article.id)}
                      class="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                    >
                      編集
                    </button>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </section>
        <Show when={drafts().length > 0}>
          <section>
            <h2 class="text-lg font-semibold mb-3 text-gray-700">下書き</h2>
            <ul class="space-y-2">
              <For each={drafts()}>
                {(article) => (
                  <li class="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm border-l-4 border-yellow-400">
                    <span class="font-medium">{article.title}</span>
                    <button
                      onClick={() => setEditingId(article.id)}
                      class="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                    >
                      編集
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
      </div>
    </Show>
  );
}
