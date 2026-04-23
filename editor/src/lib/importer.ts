export interface ImportedFiles {
  manifest: File;
  articles: Map<string, File>;     // article id -> File
  fileEntries: Map<string, File>;  // dir-uuid -> File
}

export async function importDataFolder(files: FileList): Promise<ImportedFiles> {
  let manifest: File | undefined;
  const articles = new Map<string, File>();
  const fileEntries = new Map<string, File>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const parts = file.webkitRelativePath.split("/");

    // Find manifest.json at root of the selected folder (e.g., "data/manifest.json")
    if (file.name === "manifest.json" && parts.length === 2) {
      manifest = file;
    }

    // data/articles/<id>.json
    if (parts.length === 3 && parts[1] === "articles" && file.name.endsWith(".json")) {
      const id = file.name.replace(/\.json$/, "");
      articles.set(id, file);
    }

    // data/files/<dir-uuid>.json
    if (parts.length === 3 && parts[1] === "files" && file.name.endsWith(".json")) {
      const dirId = file.name.replace(/\.json$/, "");
      fileEntries.set(dirId, file);
    }
  }

  if (!manifest) {
    throw new Error("manifest.json が見つかりません。data/ フォルダを選択してください。");
  }

  return { manifest, articles, fileEntries };
}

export async function readJsonFile<T>(file: File): Promise<T> {
  const text = await file.text();
  return JSON.parse(text) as T;
}
