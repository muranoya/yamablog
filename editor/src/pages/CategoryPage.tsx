import { createSignal, For, Show } from "solid-js";
import {
  getManifest,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "../store/manifest";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { GripVerticalIcon, PencilIcon, TrashIcon, TagIcon, PlusIcon } from "../components/icons";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

type ModalMode = "create" | "edit";

export default function CategoryPage() {
  const [modalMode, setModalMode] = createSignal<ModalMode | null>(null);
  const [editingCatId, setEditingCatId] = createSignal<number | null>(null);
  const [formName, setFormName] = createSignal("");
  const [formSlug, setFormSlug] = createSignal("");
  const [slugAutoSync, setSlugAutoSync] = createSignal(true);
  const [dragOverId, setDragOverId] = createSignal<number | null>(null);
  let draggingId: number | null = null;

  const sorted = () =>
    [...(getManifest()?.categories ?? [])].sort((a, b) => a.priority - b.priority);

  const slugError = (): string | null => {
    const slug = formSlug();
    if (!slug) return "スラッグを入力してください";
    if (!SLUG_PATTERN.test(slug)) return "半角英小文字・数字・ハイフンのみ（先頭は英数字）";
    const cats = getManifest()?.categories ?? [];
    const duplicate = cats.find((c) => c.slug === slug && c.id !== editingCatId());
    if (duplicate) return "このスラッグはすでに使われています";
    return null;
  };

  function openCreate() {
    setEditingCatId(null);
    setFormName("");
    setFormSlug("");
    setSlugAutoSync(true);
    setModalMode("create");
  }

  function openEdit(cat: { id: number; slug: string; name: string }) {
    setEditingCatId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setSlugAutoSync(false);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingCatId(null);
  }

  function handleNameInput(value: string) {
    setFormName(value);
    if (slugAutoSync()) {
      setFormSlug(toSlug(value));
    }
  }

  function handleSlugInput(value: string) {
    setFormSlug(value);
    setSlugAutoSync(false);
  }

  function handleSubmit() {
    if (slugError() || !formName().trim()) return;
    if (modalMode() === "create") {
      addCategory(formSlug(), formName().trim());
    } else {
      updateCategory(editingCatId()!, formSlug(), formName().trim());
    }
    closeModal();
  }

  function handleDragStart(e: DragEvent, id: number) {
    draggingId = id;
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", String(id));
  }

  function handleDragOver(e: DragEvent, id: number) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    setDragOverId(id);
  }

  function handleDrop(e: DragEvent, targetId: number) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDragOverId(null);
      draggingId = null;
      return;
    }
    const cats = sorted();
    const fromIdx = cats.findIndex((c) => c.id === draggingId);
    const toIdx = cats.findIndex((c) => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...cats];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    reorderCategories(reordered.map((c) => c.id));
    draggingId = null;
    setDragOverId(null);
  }

  return (
    <>
      <div class="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200 shadow-sm">
        <div class="max-w-2xl mx-auto px-8 py-2.5">
          <PageHeader
            title="カテゴリ"
            class="mb-0"
            action={
              <Button variant="primary" size="sm" onClick={openCreate}>
                <PlusIcon />
                カテゴリを追加
              </Button>
            }
          />
        </div>
      </div>
      <div class="max-w-2xl mx-auto px-8 py-8">
        <Show
          when={sorted().length > 0}
          fallback={
            <EmptyState
              icon={<TagIcon size={24} />}
              title="カテゴリがありません"
              description="カテゴリを追加して記事を分類しましょう"
              action={
                <Button variant="primary" size="md" onClick={openCreate}>
                  <PlusIcon />
                  カテゴリを追加
                </Button>
              }
            />
          }
        >
          <Card>
            <CardHeader>
              <p class="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {sorted().length} カテゴリ
              </p>
            </CardHeader>
            <For each={sorted()}>
              {(cat, i) => (
                <div
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, cat.id)}
                  onDragOver={(e) => handleDragOver(e, cat.id)}
                  onDrop={(e) => handleDrop(e, cat.id)}
                  onDragEnd={() => { draggingId = null; setDragOverId(null); }}
                  class={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                    i() < sorted().length - 1 ? "border-b border-zinc-100" : ""
                  } ${
                    dragOverId() === cat.id
                      ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  <div class="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors shrink-0">
                    <GripVerticalIcon />
                  </div>

                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium text-zinc-900">{cat.name}</span>
                    <span class="ml-2 font-mono text-xs text-zinc-400">{cat.slug}</span>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(cat)} title="編集">
                      <PencilIcon class="text-zinc-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`「${cat.name}」を削除しますか？`))
                          deleteCategory(cat.id);
                      }}
                      title="削除"
                    >
                      <TrashIcon class="text-red-400" />
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </Card>
        </Show>

        <Modal
          open={modalMode() !== null}
          onClose={closeModal}
          title={modalMode() === "create" ? "カテゴリを追加" : "カテゴリを編集"}
        >
          <div class="px-6 py-5 space-y-4">
            <Input
              label="カテゴリ名"
              required
              value={formName()}
              onInput={(e) => handleNameInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="例: 北アルプス"
              autofocus
            />
            <Input
              label="スラッグ (URL)"
              required
              value={formSlug()}
              onInput={(e) => handleSlugInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="例: kita-alps"
              hint="URLパスに使用されます。半角英小文字・数字・ハイフンのみ"
              error={formSlug() ? (slugError() ?? undefined) : undefined}
            />
            <div class="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="md" onClick={closeModal}>
                キャンセル
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                disabled={!formName().trim() || !!slugError()}
              >
                {modalMode() === "create" ? "追加" : "保存"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
