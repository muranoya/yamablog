import { createSignal, Show, Switch, Match } from "solid-js";
import ImportPage from "./pages/ImportPage";
import ArticleListPage from "./pages/ArticleListPage";
import FilesPage from "./pages/FilesPage";
import CategoryPage from "./pages/CategoryPage";
import MapMemoPage from "./pages/MapMemoPage";
import SettingsPage from "./pages/SettingsPage";
import Layout from "./components/Layout";

type Page = "articles" | "files" | "categories" | "map_memos" | "settings";

export default function App() {
  const [imported, setImported] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal<Page>("articles");

  return (
    <Show
      when={imported()}
      fallback={<ImportPage onImported={() => setImported(true)} />}
    >
      <Layout onNavigate={setCurrentPage} currentPage={currentPage()}>
        <Switch>
          <Match when={currentPage() === "articles"}>
            <ArticleListPage />
          </Match>
          <Match when={currentPage() === "files"}>
            <FilesPage />
          </Match>
          <Match when={currentPage() === "categories"}>
            <CategoryPage />
          </Match>
          <Match when={currentPage() === "map_memos"}>
            <MapMemoPage />
          </Match>
          <Match when={currentPage() === "settings"}>
            <SettingsPage />
          </Match>
        </Switch>
      </Layout>
    </Show>
  );
}
