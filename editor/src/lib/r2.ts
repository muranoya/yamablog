import { createSignal } from "solid-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { R2Config } from "./crypto";
import type { ProcessedImage } from "./image";
import type { DbImage } from "../store/files";

let client: S3Client | null = null;
let currentBucket: string | null = null;
let currentConfig: R2Config | null = null;
const [publicUrl, setPublicUrl] = createSignal<string | null>(null);

export function getCurrentR2Config(): R2Config | null {
  return currentConfig;
}

export function initR2Client(config: R2Config) {
  currentConfig = config;
  client = new S3Client({
    region: "auto",
    ...(config.endpointUrl ? { endpoint: config.endpointUrl } : {}),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  currentBucket = config.bucket;
  setPublicUrl(config.publicUrl ? config.publicUrl.replace(/\/+$/, '') : null);
}

export function getPublicImageUrl(
  uuid: string,
  size: "small" | "medium" | "original"
): string | null {
  const url = publicUrl();
  if (!url) return null;
  return `${url}/images/${uuid}-${size}.webp`;
}

export function getSmallSrc(img: DbImage): string | null {
  const url = publicUrl();
  if (!url) return null;
  const suffix = img.small_width !== null ? "small" : "original";
  return `${url}/images/${img.uuid}-${suffix}.webp`;
}

export function getMediumSrc(img: DbImage): string | null {
  const url = publicUrl();
  if (!url) return null;
  const suffix = img.medium_width !== null ? "medium" : "original";
  return `${url}/images/${img.uuid}-${suffix}.webp`;
}

export function getOriginalSrc(img: DbImage): string | null {
  const url = publicUrl();
  if (!url) return null;
  return `${url}/images/${img.uuid}-original.webp`;
}

export async function uploadBlob(key: string, blob: Blob, contentType: string): Promise<void> {
  if (!client || !currentBucket) throw new Error("ストレージクライアントが初期化されていません");
  const buf = await blob.arrayBuffer();
  await client.send(new PutObjectCommand({
    Bucket: currentBucket,
    Key: key,
    Body: new Uint8Array(buf),
    ContentType: contentType,
  }));
}

export async function uploadImage(uuid: string, processed: ProcessedImage): Promise<void> {
  const uploads: Promise<void>[] = [
    uploadBlob(`images/${uuid}-original.webp`, processed.original, "image/webp"),
  ];
  if (processed.small) {
    uploads.push(uploadBlob(`images/${uuid}-small.webp`, processed.small, "image/webp"));
  }
  if (processed.medium) {
    uploads.push(uploadBlob(`images/${uuid}-medium.webp`, processed.medium, "image/webp"));
  }
  await Promise.all(uploads);
}
