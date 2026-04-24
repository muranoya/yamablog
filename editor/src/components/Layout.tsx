import type { JSX } from "solid-js";
import ExportButton from "./ExportButton";

type Page = "articles" | "files" | "categories" | "map_memos" | "settings";

interface Props {
  children: JSX.Element;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

const navItems: Array<{ page: Page; label: string }> = [
  { page: "articles", label: "記事" },
  { page: "files", label: "ファイル" },
  { page: "categories", label: "カテゴリ" },
  { page: "map_memos", label: "マップメモ" },
  { page: "settings", label: "設定" },
];

export default function Layout(props: Props) {
  return (
    <div class="flex h-screen overflow-hidden bg-gray-50">
      <nav class="w-48 bg-white border-r border-gray-200 p-4 flex flex-col gap-1 flex-shrink-0 h-screen overflow-y-auto">
        <h1 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">yamablog</h1>
        {navItems.map(({ page, label }) => (
          <button
            onClick={() => props.onNavigate(page)}
            class={`text-left px-3 py-2 rounded-lg text-sm transition ${
              props.currentPage === page
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
        <div class="mt-auto">
          <ExportButton />
        </div>
      </nav>
      <main class="flex-1 overflow-auto">
        {props.children}
      </main>
    </div>
  );
}
