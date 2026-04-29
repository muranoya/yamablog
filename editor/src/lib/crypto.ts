export interface S3Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
}

const STORAGE_KEY = "yamablog_s3_config";
const PUBLIC_CONFIG_KEY = "yamablog_s3_public_config";
const LEGACY_STORAGE_KEY = "yamablog_r2_config";
const LEGACY_PUBLIC_CONFIG_KEY = "yamablog_r2_public_config";

export function savePublicConfig(config: Partial<S3Config>): void {
  const { secretAccessKey: _s, ...pub } = config as S3Config;
  localStorage.setItem(PUBLIC_CONFIG_KEY, JSON.stringify(pub));
}

export function loadPublicConfig(): Partial<S3Config> {
  const raw = localStorage.getItem(PUBLIC_CONFIG_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function clearS3Config(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PUBLIC_CONFIG_KEY);
}

export async function saveS3Config(config: S3Config, passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(config));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext);

  const payload = {
    salt: bufToBase64(salt),
    iv: bufToBase64(iv),
    data: bufToBase64(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  savePublicConfig(config);
}

export async function loadS3Config(passphrase: string): Promise<S3Config | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const { salt, iv, data } = JSON.parse(raw);
    const key = await deriveKey(passphrase, base64ToBuf(salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuf(iv) as BufferSource },
      key,
      base64ToBuf(data) as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as S3Config;
  } catch {
    return null;
  }
}

export function hasStoredConfig(): boolean {
  // 旧キー（r2）から新キー（s3）への一度限りの移行
  if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, localStorage.getItem(LEGACY_STORAGE_KEY)!);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  if (!localStorage.getItem(PUBLIC_CONFIG_KEY) && localStorage.getItem(LEGACY_PUBLIC_CONFIG_KEY)) {
    localStorage.setItem(PUBLIC_CONFIG_KEY, localStorage.getItem(LEGACY_PUBLIC_CONFIG_KEY)!);
    localStorage.removeItem(LEGACY_PUBLIC_CONFIG_KEY);
  }
  return localStorage.getItem(STORAGE_KEY) !== null;
}

async function deriveKey(passphrase: string, salt: ArrayBuffer | ArrayBufferView): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufToBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function base64ToBuf(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split("").map((c) => c.charCodeAt(0)));
}

const LAST_DATA_DIR_KEY = "yamablog_last_data_dir";

export function saveLastDataDir(dir: string): void {
  localStorage.setItem(LAST_DATA_DIR_KEY, dir);
}

export function getLastDataDir(): string | null {
  return localStorage.getItem(LAST_DATA_DIR_KEY);
}

export function clearLastDataDir(): void {
  localStorage.removeItem(LAST_DATA_DIR_KEY);
}
