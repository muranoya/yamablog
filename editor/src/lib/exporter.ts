import JSZip from "jszip";
import { getDirtyFiles } from "../store/dirty";
import { getManifest } from "../store/manifest";
import { getArticleData } from "../store/article";
import { getDirectoryFiles } from "../store/files";

export async function exportChangedFiles(): Promise<void> {
  const dirty = getDirtyFiles();
  if (dirty.size === 0) {
    alert("変更されたファイルはありません");
    return;
  }

  const zip = new JSZip();
  const dataFolder = zip.folder("data")!;

  for (const path of dirty) {
    if (path === "manifest.json") {
      const manifest = getManifest();
      if (manifest) {
        dataFolder.file("manifest.json", JSON.stringify(manifest, null, 2));
      }
    } else if (path.startsWith("articles/")) {
      const id = path.replace(/^articles\//, "").replace(/\.json$/, "");
      const article = getArticleData(id);
      if (article) {
        dataFolder.folder("articles")!.file(`${id}.json`, JSON.stringify(article, null, 2));
      }
    } else if (path.startsWith("files/")) {
      const dirId = path.replace(/^files\//, "").replace(/\.json$/, "");
      const files = getDirectoryFiles(dirId);
      if (files) {
        dataFolder.folder("files")!.file(`${dirId}.json`, JSON.stringify(files, null, 2));
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yamablog-export-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
