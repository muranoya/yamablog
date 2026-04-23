export interface R2Config {
  endpointUrl: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const STORAGE_KEY = "yamablog_r2_config";

export async function saveR2Config(config: R2Config, passphrase: string): Promise<void> {
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
}

export async function loadR2Config(passphrase: string): Promise<R2Config | null> {
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
    return JSON.parse(new TextDecoder().decode(plaintext)) as R2Config;
  } catch {
    return null;
  }
}

export function hasStoredConfig(): boolean {
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
