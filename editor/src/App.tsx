import { batch, createSignal, Switch, Match } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { hasStoredConfig, getLastDataDir, saveLastDataDir, type R2Config } from "./lib/crypto";
import { loadFromDataDir } from "./lib/importer";
import SetupStoragePage from "./pages/SetupStoragePage";
import SetupPasswordPage from "./pages/SetupPasswordPage";
import UnlockPage from "./pages/UnlockPage";
import ImportPage from "./pages/ImportPage";
import Layout, { type Page } from "./components/Layout";
import ArticleListPage from "./pages/ArticleListPage";
import DirectoryListPage from "./pages/DirectoryListPage";
import FileListPage from "./pages/FileListPage";
import CategoryPage from "./pages/CategoryPage";
import MapMemoPage from "./pages/MapMemoPage";
import BlogSettingsPage from "./pages/BlogSettingsPage";
import SettingsPage from "./pages/SettingsPage";

type AppStep = "setup-storage" | "setup-password" | "unlocking" | "dir-picker" | "ready";

export default function App() {
  const initialStep: AppStep = hasStoredConfig() ? "unlocking" : "setup-storage";
  const [step, setStep] = createSignal<AppStep>(initialStep);
  const [currentPage, setCurrentPage] = createSignal<Page>("articles");
  const [pendingConfig, setPendingConfig] = createSignal<R2Config | null>(null);
  const [selectedDirId, setSelectedDirId] = createSignal<number | null>(null);

  async function handleUnlocked() {
    const savedDir = getLastDataDir();
    if (!savedDir) {
      setStep("dir-picker");
      return;
    }
    try {
      await invoke("open_db_from_data_dir", { dataDir: savedDir });
      await loadFromDataDir(savedDir);
      setStep("ready");
    } catch {
      setStep("dir-picker");
    }
  }

  async function handleDirSelected(dataDir: string) {
    await loadFromDataDir(dataDir);
    saveLastDataDir(dataDir);
    setStep("ready");
  }

  function handleNavigate(page: Page, extra?: { dirId?: number }) {
    batch(() => {
      setCurrentPage(page);
      if (extra?.dirId !== undefined) setSelectedDirId(extra.dirId);
    });
  }

  return (
    <Switch>
      <Match when={step() === "setup-storage"}>
        <SetupStoragePage
          onNext={(config) => {
            setPendingConfig(config);
            setStep("setup-password");
          }}
        />
      </Match>
      <Match when={step() === "setup-password"}>
        <SetupPasswordPage
          config={pendingConfig()!}
          onDone={() => setStep("dir-picker")}
        />
      </Match>
      <Match when={step() === "unlocking"}>
        <UnlockPage onUnlocked={handleUnlocked} />
      </Match>
      <Match when={step() === "dir-picker"}>
        <ImportPage onSelected={handleDirSelected} />
      </Match>
      <Match when={step() === "ready"}>
        <Layout onNavigate={handleNavigate} currentPage={currentPage()}>
          <Switch>
            <Match when={currentPage() === "articles"}>
              <ArticleListPage />
            </Match>
            <Match when={currentPage() === "directories"}>
              <DirectoryListPage
                onOpenDir={(dirId) => handleNavigate("file-list", { dirId })}
              />
            </Match>
            <Match when={currentPage() === "file-list"}>
              <FileListPage
                dirId={selectedDirId()!}
                onBack={() => setCurrentPage("directories")}
              />
            </Match>
            <Match when={currentPage() === "categories"}>
              <CategoryPage />
            </Match>
            <Match when={currentPage() === "map_memos"}>
              <MapMemoPage />
            </Match>
            <Match when={currentPage() === "blog-settings"}>
              <BlogSettingsPage />
            </Match>
            <Match when={currentPage() === "settings"}>
              <SettingsPage />
            </Match>
          </Switch>
        </Layout>
      </Match>
    </Switch>
  );
}
