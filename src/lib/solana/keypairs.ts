import { generateKeyPair, getAddressFromPublicKey } from '@solana/kit'

/** Generate a new Ed25519 keypair and return the address + exportable secret bytes */
export async function generateNewKeypair(): Promise<{
  publicKey: string
  secretKeyBytes: Uint8Array
}> {
  const kp = await generateKeyPair()
  const publicKey = await getAddressFromPublicKey(kp.publicKey)
  // Export private key scalar as raw bytes (32 bytes)
  const privRaw = await crypto.subtle.exportKey('raw', kp.privateKey)
  // Export public key as raw bytes (32 bytes)
  const pubRaw = await crypto.subtle.exportKey('raw', kp.publicKey)
  // Solana CLI format: 64 bytes = private(32) + public(32)
  const secretKeyBytes = new Uint8Array(64)
  secretKeyBytes.set(new Uint8Array(privRaw), 0)
  secretKeyBytes.set(new Uint8Array(pubRaw), 32)
  return { publicKey, secretKeyBytes }
}

/** Derive the public key address from a 64-byte secret key (Solana CLI format) */
export async function publicKeyFromSecretBytes(secretKeyBytes: Uint8Array): Promise<string> {
  // The last 32 bytes are the public key in Solana CLI format
  const pubKeyBytes = secretKeyBytes.slice(32, 64)
  const pubKey = await crypto.subtle.importKey(
    'raw',
    pubKeyBytes,
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    true,
    ['verify'],
  )
  return getAddressFromPublicKey(pubKey)
}

/** Encrypt secret key bytes with a password using AES-GCM */
export async function encryptSecretKey(
  secretKeyBytes: Uint8Array,
  password: string,
): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    secretKeyBytes.buffer as ArrayBuffer,
  )

  // Pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(16 + 12 + encrypted.byteLength)
  packed.set(salt, 0)
  packed.set(iv, 16)
  packed.set(new Uint8Array(encrypted), 28)
  return btoa(String.fromCharCode(...packed))
}

/** Decrypt secret key bytes with a password */
export async function decryptSecretKey(
  encryptedB64: string,
  password: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const packed = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0))
  const salt = packed.slice(0, 16)
  const iv = packed.slice(16, 28)
  const ciphertext = packed.slice(28)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
  return new Uint8Array(decrypted)
}

/** Download a keypair as a Solana CLI-compatible JSON file */
export function downloadKeypairJson(secretKeyBytes: Uint8Array, filename: string) {
  const json = JSON.stringify(Array.from(secretKeyBytes))
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
