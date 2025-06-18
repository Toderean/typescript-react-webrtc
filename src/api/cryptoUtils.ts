import { API_URL, authHeaders } from "./signaling";

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(b64url: string | Uint8Array): Uint8Array {
  if (typeof b64url !== "string") {
    throw new Error("fromBase64Url: expected string but got " + typeof b64url);
  }
  const b64 = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(b64url.length + (4 - b64url.length % 4) % 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function generateKeyPair() {
  return window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKeyPEM(publicKey: CryptoKey): Promise<string> {
  const spki = await window.crypto.subtle.exportKey("spki", publicKey);
  const b64 = window.btoa(String.fromCharCode(...new Uint8Array(spki)));
  return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

export async function exportPrivateKeyPEM(privateKey: CryptoKey): Promise<string> {
  const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", privateKey);
  const b64 = window.btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
}

export function downloadPEM(pem: string, filename = "private_key.pem") {
  const blob = new Blob([pem], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importPublicKeyFromPEM(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----|\n/g, "");
  const raw = Uint8Array.from(window.atob(b64), c => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "spki",
    raw,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKeyFromPEM(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\n/g, "");
  const raw = Uint8Array.from(window.atob(b64), c => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function generateSessionKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportSessionKeyB64(key: CryptoKey): Promise<string> {
  const raw = await window.crypto.subtle.exportKey("raw", key);
  const arr = Array.from(new Uint8Array(raw));
  const str = String.fromCharCode(...arr);
  return window.btoa(str);
}

export async function importSessionKeyB64(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(window.atob(b64), c => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "raw",
    raw,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptWithSessionKey(key: CryptoKey, plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(result);
}

export async function decryptWithSessionKey(key: CryptoKey, b64url: string): Promise<string> {
  if (typeof b64url !== "string") {
    console.error("Expected string, got:", typeof b64url, b64url);
    throw new Error("Input to decryptWithSessionKey must be a base64 string.");
  }
  const data = fromBase64Url(b64url);
  if (data.length < 12) {
    throw new Error(`Invalid encrypted data. Length = ${data.length}, expected >= 12.`);
  }
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("Decryption failed. IV:", iv);
    console.error("Ciphertext length:", ciphertext.length);
    throw err;
  }
}

export async function getPeerPublicKey(username: string): Promise<CryptoKey> {
  const res = await fetch(`${API_URL}/users/${username}`, authHeaders());
  if (!res.ok) {
    throw new Error(`Nu am putut obține cheia publică pentru ${username}`);
  }

  const data = await res.json();
  return await importPublicKeyFromPEM(data.public_key);
}

export async function encryptRSA(pubKey: CryptoKey, message: string): Promise<string> {
  const encoded = new TextEncoder().encode(message);
  const ct = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, encoded);
  return window.btoa(String.fromCharCode(...new Uint8Array(ct)));
}

export async function decryptRSA(privKey: CryptoKey, cipherB64: string): Promise<string> {
  try {
    const raw = Uint8Array.from(window.atob(cipherB64), c => c.charCodeAt(0));
    const pt = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, raw);
    return new TextDecoder().decode(pt);
  } catch (err) {
    console.error("Decriptare RSA eșuată. Stringul poate fi corupt:", cipherB64);
    throw err;
  }
}


export async function encryptMessageForUser(
  message: string,
  receiverPublicKey: CryptoKey,
  aesKey: CryptoKey 
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(message)
  );

  const rawKey = await crypto.subtle.exportKey("raw", aesKey); 
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    receiverPublicKey,
    rawKey
  );

  const payload = {
    key: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(ciphertext),
  };

  return btoa(JSON.stringify(payload));
}



function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(buffer))
  return btoa(binary)
}