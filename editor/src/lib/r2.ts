import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { R2Config } from "./crypto";
import type { ProcessedImage } from "./image";

let client: S3Client | null = null;
let currentBucket: string | null = null;

export function initR2Client(config: R2Config) {
  client = new S3Client({
    region: "auto",
    endpoint: config.endpointUrl,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  currentBucket = config.bucket;
}

export async function uploadBlob(key: string, blob: Blob, contentType: string): Promise<void> {
  if (!client || !currentBucket) throw new Error("R2 client not initialized");
  const buf = await blob.arrayBuffer();
  await client.send(new PutObjectCommand({
    Bucket: currentBucket,
    Key: key,
    Body: new Uint8Array(buf),
    ContentType: contentType,
  }));
}

export async function uploadImage(uuid: string, processed: ProcessedImage): Promise<void> {
  await Promise.all([
    uploadBlob(`images/${uuid}-small.webp`, processed.small, "image/webp"),
    uploadBlob(`images/${uuid}-medium.webp`, processed.medium, "image/webp"),
    uploadBlob(`images/${uuid}-original.webp`, processed.original, "image/webp"),
  ]);
}
