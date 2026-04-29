import ExifReader from "exifreader";

export interface ProcessedImage {
  small: Blob | undefined;    // original > 300px のときのみ生成
  medium: Blob | undefined;   // original > 1024px のときのみ生成
  original: Blob;
  smallSize: { width: number; height: number } | undefined;
  mediumSize: { width: number; height: number } | undefined;
  originalSize: { width: number; height: number };
  shootingDatetime: string | null;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const shootingDatetime = await extractShootingDatetime(file);
  const img = await loadImage(file);

  const originalSize = { width: img.naturalWidth, height: img.naturalHeight };
  const needsSmall = img.naturalWidth > 300;
  const needsMedium = img.naturalWidth > 1024;

  const smallSize = needsSmall ? calcResizeTarget(img.naturalWidth, img.naturalHeight, 300) : undefined;
  const mediumSize = needsMedium ? calcResizeTarget(img.naturalWidth, img.naturalHeight, 1024) : undefined;

  const [original, small, medium] = await Promise.all([
    resizeToWebp(img, originalSize.width, originalSize.height),
    smallSize ? resizeToWebp(img, smallSize.width, smallSize.height) : Promise.resolve(undefined),
    mediumSize ? resizeToWebp(img, mediumSize.width, mediumSize.height) : Promise.resolve(undefined),
  ]);

  return { small, medium, original, smallSize, mediumSize, originalSize, shootingDatetime };
}

async function extractShootingDatetime(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const tags = ExifReader.load(buffer);
    const dt = tags["DateTimeOriginal"]?.description;
    if (!dt) return null;
    // "2024:08:01 08:30:00" → "2024-08-01T08:30:00"
    const normalized = dt.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
    return normalized;
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function calcResizeTarget(w: number, h: number, maxWidth: number): { width: number; height: number } {
  if (w <= maxWidth) return { width: w, height: h };
  const ratio = maxWidth / w;
  return { width: maxWidth, height: Math.round(h * ratio) };
}

function resizeToWebp(img: HTMLImageElement, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")),
      "image/webp",
      0.85
    );
  });
}
