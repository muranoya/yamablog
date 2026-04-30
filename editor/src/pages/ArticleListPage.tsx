import { createSignal, For, Show } from "solid-js";
import {
  getManifest,
  addArticle,
  deleteArticle,
  updateArticleSummaryLocal,
  type DbArticleSummary,
} from "../store/manifest";
import { saveArticle } from "../store/article";
import ArticleEditPage from "./ArticleEditPage";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { PlusIcon, PencilIcon, TrashIcon, DocumentIcon, EyeIcon, EyeOffIcon } from "../components/icons";

type Filter = "all" | "published" | "draft";

export default function ArticleListPage() {
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [filter, setFilter] = createSignal<Filter>("all");

  const allArticles = () =>
    [...(getManifest()?.articles ?? [])].sort((a, b) => b.created_at - a.created_at);

  const filteredArticles = () => {
    const f = filter();
    const articles = allArticles();
    if (f === "all") return articles;
    return articles.filter((a) => a.status === f);
  };

  async function handleNewArticle() {
    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6);
    const slug = `draft-${yyyymmdd}-${rand}`;
    const created_at = Math.floor(Date.now() / 1000);
    const id = await addArticle(slug, "新規記事", "draft", created_at);
    setEditingId(id);
  }

  async function handleDelete(article: DbArticleSummary, e: MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`「${article.title}」を削除しますか？\nこの操作は取り消せません。`)) return;
    await deleteArticle(article.id);
  }

  async function handleToggleStatus(article: DbArticleSummary, e: MouseEvent) {
    e.stopPropagation();
    const newStatus = article.status === "published" ? "draft" : "published";
    updateArticleSummaryLocal(article.id, { status: newStatus });
    await saveArticle(article.id);
  }

  const TABS: { value: Filter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "published", label: "公開済み" },
    { value: "draft", label: "下書き" },
  ];

  return (
    <Show
      when={!editingId()}
      fallback={
        <ArticleEditPage
          articleId={editingId()!}
          onBack={() => setEditingId(null)}
        />
      }
    >
      <>
        <div class="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200 shadow-sm">
          <div class="max-w-4xl mx-auto px-8 py-2">
            <PageHeader
              title="記事一覧"
              class="mb-0"
              action={
                <Button variant="primary" size="sm" onClick={handleNewArticle}>
                  <PlusIcon />
                  記事を追加
                </Button>
              }
            />
          </div>
        </div>
        <div class="max-w-4xl mx-auto px-8 pt-4">
          <div class="flex items-center gap-1 mb-6 border-b border-zinc-200">
            {TABS.map((tab) => (
              <button
                onClick={() => setFilter(tab.value)}
                class={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  filter() === tab.value
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
                {tab.value !== "all" && (
                  <span class="ml-1.5 text-xs text-zinc-400">
                    {allArticles().filter((a) => a.status === tab.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Show
            when={filteredArticles().length > 0}
            fallback={
              <EmptyState
                icon={<DocumentIcon size={24} />}
                title="記事がありません"
                description={
                  filter() === "all"
                    ? "最初の記事を作成しましょう"
                    : filter() === "published"
                    ? "公開済みの記事はありません"
                    : "下書きの記事はありません"
                }
                action={
                  filter() === "all" ? (
                    <Button variant="primary" size="sm" onClick={handleNewArticle}>
                      <PlusIcon />
                      最初の記事を作成
                    </Button>
                  ) : undefined
                }
              />
            }
          >
            <Card>
              <For each={filteredArticles()}>
                {(article, i) => (
                  <div
                    class={`flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 cursor-pointer transition-colors ${
                      i() < filteredArticles().length - 1 ? "border-b border-zinc-100" : ""
                    }`}
                    onClick={() => setEditingId(article.id)}
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-zinc-900 truncate">{article.title}</span>
                        <Badge variant={article.status === "published" ? "published" : "draft"}>
                          {article.status === "published" ? "公開済み" : "下書き"}
                        </Badge>
                      </div>
                      <p class="text-xs text-zinc-400 mt-0.5 font-mono">
                        {new Date(article.created_at * 1000).toISOString().substring(0, 10)}
                        {" "}· {article.slug}
                      </p>
                    </div>

                    <div class="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={article.status === "published" ? "下書きに戻す" : "公開する"}
                        onClick={(e) => handleToggleStatus(article, e)}
                      >
                        {article.status === "published"
                          ? <EyeOffIcon class="text-zinc-400" />
                          : <EyeIcon class="text-zinc-400" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="編集"
                        onClick={() => setEditingId(article.id)}
                      >
                        <PencilIcon class="text-zinc-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="削除"
                        onClick={(e) => handleDelete(article, e)}
                      >
                        <TrashIcon class="text-red-400" />
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </Card>
          </Show>
        </div>
      </>
    </Show>
  );
}
