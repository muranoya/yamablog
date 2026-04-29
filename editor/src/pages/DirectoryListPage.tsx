import { createSignal, For, Show } from "solid-js";
import {
  getManifest,
  addDirectory,
  updateDirectory,
  deleteDirectory,
} from "../store/manifest";
import {
  getDirectoryImages,
  isLoaded,
  setDirectoryImages,
} from "../store/files";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import {
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DotsIcon,
  ChevronRightIcon,
} from "../components/icons";

interface Props {
  onOpenDir: (dirId: number) => void;
}

export default function DirectoryListPage(props: Props) {
  const [newDirName, setNewDirName] = createSignal("");
  const [addingNew, setAddingNew] = createSignal(false);
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [editingName, setEditingName] = createSignal("");
  const [menuOpenId, setMenuOpenId] = createSignal<number | null>(null);

  async function handleAddDir() {
    const name = newDirName().trim();
    if (!name) return;
    const id = await addDirectory(name);
    setDirectoryImages(id, []);
    setNewDirName("");
    setAddingNew(false);
  }

  function handleCancel() {
    setAddingNew(false);
    setNewDirName("");
  }

  async function commitEdit(id: number) {
    const name = editingName().trim();
    if (name) await updateDirectory(id, name);
    setEditingId(null);
  }

  async function handleDelete(dir: { id: number; name: string }) {
    if (!window.confirm(`「${dir.name}」を削除しますか？`)) return;
    await deleteDirectory(dir.id);
  }

  const dirs = () =>
    [...(getManifest()?.directories ?? [])].sort((a, b) => b.created_at - a.created_at);

  const imageCount = (dirId: number) => {
    if (!isLoaded(dirId)) return null;
    return getDirectoryImages(dirId)?.length ?? 0;
  };

  return (
    <>
      <div class="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200 shadow-sm">
        <div class="max-w-4xl mx-auto px-8 py-2.5">
          <PageHeader
            title="ディレクトリ"
            class="mb-0"
            action={
              <Button variant="primary" size="sm" onClick={() => setAddingNew(true)}>
                <PlusIcon />
                ディレクトリを追加
              </Button>
            }
          />
        </div>
      </div>
      <div class="max-w-4xl mx-auto px-8 py-8">
        <Modal open={addingNew()} onClose={handleCancel} title="新しいディレクトリ">
          <div class="p-6 space-y-4">
            <Input
              placeholder="ディレクトリ名"
              value={newDirName()}
              onInput={(e: Event) =>
                setNewDirName((e.currentTarget as HTMLInputElement).value)
              }
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") handleAddDir();
                if (e.key === "Escape") handleCancel();
              }}
              autofocus
            />
            <div class="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={handleCancel}>
                キャンセル
              </Button>
              <Button variant="primary" size="md" onClick={handleAddDir}>
                作成
              </Button>
            </div>
          </div>
        </Modal>

        <Show
          when={dirs().length > 0}
          fallback={
            <EmptyState
              icon={<FolderIcon size={24} />}
              title="ディレクトリがありません"
              description="ディレクトリを作成して画像を整理しましょう"
              action={
                <Button variant="primary" size="sm" onClick={() => setAddingNew(true)}>
                  <PlusIcon />
                  最初のディレクトリを作成
                </Button>
              }
            />
          }
        >
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
            <For each={dirs()}>
              {(dir) => (
                <div class="relative" onMouseLeave={() => setMenuOpenId(null)}>
                  <Show
                    when={editingId() === dir.id}
                    fallback={
                      <div
                        class="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => props.onOpenDir(dir.id)}
                      >
                        <div class="flex items-start justify-between mb-3">
                          <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <FolderIcon size={20} class="text-indigo-500" />
                          </div>
                          <button
                            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId() === dir.id ? null : dir.id);
                            }}
                          >
                            <DotsIcon />
                          </button>
                        </div>

                        <p class="font-semibold text-zinc-900 text-sm truncate">{dir.name}</p>
                        <div class="flex items-center justify-between mt-1">
                          <p class="text-xs text-zinc-400">
                            {imageCount(dir.id) !== null
                              ? `${imageCount(dir.id)} 画像`
                              : ""}
                          </p>
                          <ChevronRightIcon class="text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    }
                  >
                    <div class="bg-white rounded-xl border border-indigo-300 shadow-sm p-4">
                      <div class="flex gap-2">
                        <input
                          type="text"
                          class="flex-1 border border-indigo-400 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingName()}
                          onInput={(e) => setEditingName(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(dir.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autofocus
                        />
                      </div>
                      <div class="flex gap-1.5 mt-2">
                        <Button variant="primary" size="sm" onClick={() => commitEdit(dir.id)}>
                          保存
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  </Show>

                  {/* 3点メニュー */}
                  <Show when={menuOpenId() === dir.id}>
                    <div class="absolute right-2 top-2 z-10 bg-white rounded-lg border border-zinc-200 shadow-lg py-1 min-w-[120px]">
                      <button
                        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(dir.id);
                          setEditingName(dir.name);
                          setMenuOpenId(null);
                        }}
                      >
                        <PencilIcon class="text-zinc-400" />
                        名前変更
                      </button>
                      <button
                        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          handleDelete(dir);
                        }}
                      >
                        <TrashIcon class="text-red-400" />
                        削除
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}
