import { createSignal, Show, Switch, Match } from "solid-js";
import ImportPage from "./pages/ImportPage";
import ArticleListPage from "./pages/ArticleListPage";
import SettingsPage from "./pages/SettingsPage";
import Layout from "./components/Layout";

type Page = "articles" | "files" | "settings";

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
          <Match when={currentPage() === "settings"}>
            <SettingsPage />
          </Match>
        </Switch>
      </Layout>
    </Show>
  );
}
