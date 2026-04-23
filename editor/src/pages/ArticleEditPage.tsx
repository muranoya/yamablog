import { createEffect, createSignal, For, Show } from "solid-js";
import { getArticleStore, loadArticle, updateBlock, addBlock, removeBlock, getArticleFile, type ArticleData, type ContentBlock } from "../store/article";
import { readJsonFile } from "../lib/importer";
import TextBlock from "../components/blocks/TextBlock";
import ImageBlock from "../components/blocks/ImageBlock";
import GpxBlock from "../components/blocks/GpxBlock";

interface Props {
  id: string;
  onBack: () => void;
}

export default function ArticleEditPage(props: Props) {
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(async () => {
    if (getArticleStore(props.id)) {
      setLoaded(true);
      return;
    }
    const file = getArticleFile(props.id);
    if (!file) {
      setError("記事ファイルが見つかりません");
      return;
    }
    try {
      const article = await readJsonFile<ArticleData>(file);
      loadArticle(props.id, article);
      setLoaded(true);
    } catch {
      setError("記事の読み込みに失敗しました");
    }
  });

  const article = () => getArticleStore(props.id);

  function handleBlockTextChange(index: number, text: string) {
    updateBlock(props.id, index, { text });
  }

  function handleDescriptionChange(index: number, description: string) {
    updateBlock(props.id, index, { description });
  }

  return (
    <div class="max-w-2xl mx-auto p-6">
      <button onClick={props.onBack} class="mb-4 text-blue-600 hover:underline text-sm">
        ← 記事一覧に戻る
      </button>

      <Show when={error()}>
        <p class="text-red-600">{error()}</p>
      </Show>

      <Show when={loaded() && article()}>
        <div class="space-y-3">
          <For each={article()!.content}>
            {(block: ContentBlock, i) => (
              <div class="group relative">
                <Show when={block.kind === "text"}>
                  <TextBlock
                    text={(block.content["text"] as string) ?? ""}
                    onChange={(text) => handleBlockTextChange(i(), text)}
                  />
                </Show>
                <Show when={block.kind === "image"}>
                  <ImageBlock
                    fileId={(block.content["file_id"] as string) ?? ""}
                    description={(block.content["description"] as string) ?? ""}
                    onDescriptionChange={(d) => handleDescriptionChange(i(), d)}
                  />
                </Show>
                <Show when={block.kind === "gpx"}>
                  <GpxBlock fileId={(block.content["file_id"] as string) ?? ""} />
                </Show>
                <button
                  onClick={() => removeBlock(props.id, i())}
                  class="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs"
                >
                  削除
                </button>
              </div>
            )}
          </For>
        </div>

        <div class="mt-4 flex gap-2">
          <button
            onClick={() => addBlock(props.id, { kind: "text", content: { text: "" } })}
            class="text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200"
          >
            + テキスト
          </button>
        </div>
      </Show>
    </div>
  );
}
