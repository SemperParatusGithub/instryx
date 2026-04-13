import nacl from 'tweetnacl'
import bs58 from 'bs58'

/**
 * Generate a new Ed25519 keypair using tweetnacl.
 * Returns the base58 public key address and the 64-byte secret key in
 * Solana CLI format: secretKey = seed(32) || publicKey(32).
 */
export async function generateNewKeypair(): Promise<{
  publicKey: string
  secretKeyBytes: Uint8Array
}> {
  const kp = nacl.sign.keyPair()
  // nacl.sign.keyPair().secretKey is already 64 bytes: seed || pubkey (Solana CLI format)
  return {
    publicKey: bs58.encode(kp.publicKey),
    secretKeyBytes: kp.secretKey,
  }
}

/**
 * Derive the public key address from a 64-byte Solana CLI secret key.
 * The last 32 bytes are the public key.
 */
export async function publicKeyFromSecretBytes(secretKeyBytes: Uint8Array): Promise<string> {
  return bs58.encode(secretKeyBytes.slice(32, 64))
}

/** Encrypt secret key bytes with a password using AES-GCM + PBKDF2 */
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
