import {
  createSolanaRpc,
  address,
  generateKeyPair,
  getAddressFromPublicKey,
  lamports,
} from '@solana/kit'

export async function fetchAccount(rpcUrl: string, pubkey: string) {
  const rpc = createSolanaRpc(rpcUrl)
  const result = await rpc
    .getAccountInfo(address(pubkey), { encoding: 'base64' })
    .send()
  return result.value
}

export async function getMinimumRentExemption(rpcUrl: string, bytes: number): Promise<bigint> {
  const rpc = createSolanaRpc(rpcUrl)
  const result = await rpc.getMinimumBalanceForRentExemption(BigInt(bytes)).send()
  return result
}

export async function requestAirdrop(
  rpcUrl: string,
  pubkey: string,
  solAmount: number,
): Promise<string> {
  const rpc = createSolanaRpc(rpcUrl)
  const amount = lamports(BigInt(Math.floor(solAmount * 1_000_000_000)))
  const sig = await rpc.requestAirdrop(address(pubkey), amount).send()
  return sig
}

export async function generateNewKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const kp = await generateKeyPair()
  const pub = await getAddressFromPublicKey(kp.publicKey)
  // Export raw bytes
  const raw = await crypto.subtle.exportKey('raw', kp.privateKey)
  return { publicKey: pub, secretKey: new Uint8Array(raw) }
}

export function lamportsToSol(l: bigint): string {
  return (Number(l) / 1_000_000_000).toFixed(6)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
}
