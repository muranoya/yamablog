import type { JSX } from "solid-js";
import ExportButton from "./ExportButton";

type Page = "articles" | "files" | "settings";

interface Props {
  children: JSX.Element;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

export default function Layout(props: Props) {
  return (
    <div class="flex min-h-screen bg-gray-50">
      <nav class="w-48 bg-white border-r border-gray-200 p-4 flex flex-col gap-1">
        <h1 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">yamablog</h1>
        {(["articles", "files", "settings"] as Page[]).map((page) => (
          <button
            onClick={() => props.onNavigate(page)}
            class={`text-left px-3 py-2 rounded-lg text-sm transition ${
              props.currentPage === page
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {page === "articles" ? "記事" : page === "files" ? "ファイル" : "設定"}
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
