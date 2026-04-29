import type { JSX } from "solid-js";
import {
  DocumentIcon,
  TagIcon,
  MapPinIcon,
  FolderIcon,
  LayoutIcon,
  GearIcon,
} from "./icons";

export type Page =
  | "articles"
  | "directories"
  | "file-list"
  | "categories"
  | "map_memos"
  | "blog-settings"
  | "settings";

interface Props {
  children: JSX.Element;
  onNavigate: (page: Page, extra?: { dirId?: number }) => void;
  currentPage: Page;
}

interface NavItemProps {
  page: Page;
  label: string;
  icon: JSX.Element;
  currentPage: Page;
  onClick: () => void;
}

function NavItem(props: NavItemProps) {
  const isActive = () =>
    props.currentPage === props.page ||
    (props.page === "directories" && props.currentPage === "file-list");

  return (
    <button
      onClick={props.onClick}
      class={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
        isActive()
          ? "bg-white/10 text-white border-l-2 border-indigo-400 pl-[10px]"
          : "text-zinc-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function NavGroup(props: { label: string; children: JSX.Element }) {
  return (
    <div class="mb-1">
      <p class="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {props.label}
      </p>
      {props.children}
    </div>
  );
}

export default function Layout(props: Props) {
  return (
    <div class="flex h-screen overflow-hidden bg-zinc-50">
      <nav class="w-56 h-screen bg-zinc-900 flex flex-col flex-shrink-0">
        <div class="px-4 py-3 border-b border-zinc-800">
          <span class="text-sm font-semibold text-white tracking-wider">yamablog</span>
          <p class="text-xs text-zinc-500 mt-0.5">editor</p>
        </div>

        <div class="flex-1 overflow-y-auto py-2 px-2">
          <NavGroup label="コンテンツ">
            <NavItem
              page="articles"
              label="記事"
              icon={<DocumentIcon class="shrink-0" />}
              currentPage={props.currentPage}
              onClick={() => props.onNavigate("articles")}
            />
            <NavItem
              page="categories"
              label="カテゴリ"
              icon={<TagIcon class="shrink-0" />}
              currentPage={props.currentPage}
              onClick={() => props.onNavigate("categories")}
            />
            <NavItem
              page="map_memos"
              label="マップメモ"
              icon={<MapPinIcon class="shrink-0" />}
              currentPage={props.currentPage}
              onClick={() => props.onNavigate("map_memos")}
            />
          </NavGroup>

          <NavGroup label="アセット">
            <NavItem
              page="directories"
              label="ディレクトリ"
              icon={<FolderIcon class="shrink-0" />}
              currentPage={props.currentPage}
              onClick={() => props.onNavigate("directories")}
            />
          </NavGroup>

          <NavGroup label="設定">
            <NavItem
              page="blog-settings"
              label="ブログ設定"
              icon={<LayoutIcon class="shrink-0" />}
              currentPage={props.currentPage}
              onClick={() => props.onNavigate("blog-settings")}
            />
            <NavItem
              page="settings"
              label="設定"
              icon={<GearIcon class="shrink-0" />}
              currentPage={props.currentPage}
              onClick={() => props.onNavigate("settings")}
            />
          </NavGroup>
        </div>

      </nav>

      <main class="flex-1 overflow-auto bg-zinc-50 min-h-screen">
        {props.children}
      </main>
    </div>
  );
}
