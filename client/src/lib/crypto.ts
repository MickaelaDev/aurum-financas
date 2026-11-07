const ITERATIONS = 210_000;

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomBase64(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64(bytes);
}

export async function deriveVaultKey(pin: string, saltBase64: string): Promise<CryptoKey> {
  const salt = base64ToBytes(saltBase64);
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource),
  );
  const result = new Uint8Array(iv.length + encrypted.length);
  result.set(iv);
  result.set(encrypted, iv.length);
  return result;
}

async function decryptBytes(key: CryptoKey, payload: Uint8Array): Promise<Uint8Array> {
  if (payload.length <= 12) throw new Error('Conteúdo inválido.');
  const iv = payload.subarray(0, 12);
  const data = payload.subarray(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return new Uint8Array(decrypted);
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const bytes = await encryptBytes(key, encoder.encode(text));
  return bytesToBase64(bytes);
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const bytes = await decryptBytes(key, base64ToBytes(payload));
  return new TextDecoder().decode(bytes);
}

export async function encryptVault(key: CryptoKey, bytes: Uint8Array): Promise<Uint8Array> {
  return encryptBytes(key, bytes);
}

export async function decryptVault(key: CryptoKey, bytes: Uint8Array): Promise<Uint8Array> {
  return decryptBytes(key, bytes);
}
