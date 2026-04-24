import { createSignal, For, Show } from "solid-js";
import {
  getManifest,
  addCategory,
  updateCategory,
  deleteCategory,
  moveCategoryUp,
  moveCategoryDown,
} from "../store/manifest";

export default function CategoryPage() {
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editingName, setEditingName] = createSignal("");
  const [newName, setNewName] = createSignal("");

  const sorted = () =>
    [...(getManifest()?.categories ?? [])].sort((a, b) => a.priority - b.priority);

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  function commitEdit(id: string) {
    const name = editingName().trim();
    if (name) updateCategory(id, name);
    setEditingId(null);
  }

  function handleAdd() {
    const name = newName().trim();
    if (!name) return;
    addCategory(name);
    setNewName("");
  }

  return (
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-6">カテゴリ管理</h1>

      <div class="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">名前</th>
              <th class="px-4 py-3 text-center text-sm font-medium text-gray-500 w-20">順序</th>
              <th class="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={sorted().length > 0}
              fallback={
                <tr>
                  <td colspan="3" class="px-4 py-6 text-center text-gray-400 text-sm">
                    カテゴリがありません
                  </td>
                </tr>
              }
            >
              <For each={sorted()}>
                {(cat, i) => (
                  <tr class="border-t border-gray-100">
                    <td class="px-4 py-3">
                      <Show
                        when={editingId() === cat.id}
                        fallback={<span>{cat.name}</span>}
                      >
                        <input
                          type="text"
                          value={editingName()}
                          onInput={(e) => setEditingName(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(cat.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          class="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                          autofocus
                        />
                      </Show>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex gap-1 justify-center">
                        <button
                          onClick={() => moveCategoryUp(cat.id)}
                          disabled={i() === 0}
                          class="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                          title="上へ"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveCategoryDown(cat.id)}
                          disabled={i() === sorted().length - 1}
                          class="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                          title="下へ"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <Show
                        when={editingId() === cat.id}
                        fallback={
                          <div class="flex gap-2 justify-end">
                            <button
                              onClick={() => startEdit(cat.id, cat.name)}
                              class="text-sm px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteCategory(cat.id)}
                              class="text-sm px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              削除
                            </button>
                          </div>
                        }
                      >
                        <div class="flex gap-2 justify-end">
                          <button
                            onClick={() => commitEdit(cat.id)}
                            class="text-sm px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            class="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            キャンセル
                          </button>
                        </div>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      <div class="flex gap-2">
        <input
          type="text"
          placeholder="新しいカテゴリ名"
          class="flex-1 border border-gray-300 rounded-lg px-3 py-2"
          value={newName()}
          onInput={(e) => setNewName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          追加
        </button>
      </div>
    </div>
  );
}
