import { D1DomainError } from "./errors";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

export async function importAesGcmKey(encodedKey: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(encodedKey.trim());
  if (raw.byteLength !== 32) {
    throw new D1DomainError(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64url-encoded 32-byte key",
      "invalid_encryption_key",
      500,
    );
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(
  plaintext: string,
  encodedKey: string,
  keyVersion = "v1",
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesGcmKey(encodedKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    encoder.encode(plaintext),
  );

  return `${keyVersion}.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(
  value: string,
  encodedKey: string,
): Promise<{ keyVersion: string; plaintext: string }> {
  const [keyVersion, ivEncoded, ciphertextEncoded] = value.split(".");
  if (!keyVersion || !ivEncoded || !ciphertextEncoded) {
    throw new D1DomainError("Invalid encrypted secret format", "invalid_ciphertext", 500);
  }

  const key = await importAesGcmKey(encodedKey);
  const iv = base64UrlDecode(ivEncoded);
  const ciphertext = base64UrlDecode(ciphertextEncoded);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );

  return { keyVersion, plaintext: decoder.decode(plaintext) };
}
