/**
 * Deploys a Solana program using the BPF Upgradeable Loader (v3).
 *
 * Protocol (5 steps):
 *   1. Create a buffer account (temp staging)
 *   2. InitializeBuffer — sets the upgrade authority
 *   3. Write ELF bytes in chunks into the buffer
 *   4. Create the program account (pre-requisite for DeployWithMaxDataLen)
 *   5. DeployWithMaxDataLen — atomically promotes the buffer to a live program
 *
 * The caller must ensure `payer` has enough SOL before calling.
 * Use `estimateDeployLamports` to compute how much to airdrop.
 */

import {
  createSolanaRpc,
  generateKeyPairSigner,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  AccountRole,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
} from '@solana/kit'
import type { KeyPairSigner, Address } from '@solana/kit'
import { getCreateAccountInstruction } from '@solana-program/system'

// ---- Constants ------------------------------------------------------------

const BPF_LOADER_UPGRADEABLE = address('BPFLoaderUpgradeab1e11111111111111111111111')
const SYSVAR_RENT             = address('SysvarRent111111111111111111111111111111111')
const SYSVAR_CLOCK            = address('SysvarC1ock11111111111111111111111111111111')
const SYSTEM_PROGRAM          = address('11111111111111111111111111111111')
const COMPUTE_BUDGET_PROGRAM  = address('ComputeBudget111111111111111111111111111111')

/**
 * Header sizes in bytes for each BPF Upgradeable Loader account type.
 * Buffer:      4 (discriminant) + 33 (Option<Pubkey>) = 37
 * Program:     4 + 32                                 = 36
 * ProgramData: 4 + 8 (slot) + 33 (Option<Pubkey>)    = 45
 */
const BUFFER_METADATA_SIZE      = 37n
const PROGRAM_ACCOUNT_SIZE      = 36n
const PROGRAMDATA_METADATA_SIZE = 45n

/** Max ELF bytes per Write instruction (stays under 1232-byte tx packet limit). */
const CHUNK_SIZE = 900

// ---- Helpers ---------------------------------------------------------------

function u32le(n: number): Uint8Array {
  const b = new ArrayBuffer(4)
  new DataView(b).setUint32(0, n, true)
  return new Uint8Array(b)
}

function u64le(n: bigint): Uint8Array {
  const b = new ArrayBuffer(8)
  new DataView(b).setBigUint64(0, n, true)
  return new Uint8Array(b)
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

/** ComputeBudget SetComputeUnitLimit instruction (discriminant 0x02, units u32 LE). */
function setComputeUnitLimitIx(units: number) {
  const data = new Uint8Array(5)
  data[0] = 0x02
  new DataView(data.buffer).setUint32(1, units, true)
  return { programAddress: COMPUTE_BUDGET_PROGRAM, accounts: [] as never[], data }
}

// ---- Low-level tx helpers --------------------------------------------------

type BlockhashInfo = { blockhash: string; lastValidBlockHeight: bigint }

/** Build, sign, and send one transaction. Returns the signature. */
async function sendOne(
  rpcUrl: string,
  payer: KeyPairSigner,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instructions: any[],
  bh: BlockhashInfo,
): Promise<string> {
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  )
  const signed = await signTransactionMessageWithSigners(msg)
  const wire   = getBase64EncodedWireTransaction(signed)
  try {
    const sig = await createSolanaRpc(rpcUrl)
      .sendTransaction(wire, { encoding: 'base64' })
      .send()
    return sig as string
  } catch (e) {
    // Extract simulation logs from SolanaError context so the caller sees useful detail
    if (e && typeof e === 'object' && 'context' in e) {
      const ctx = (e as { context: Record<string, unknown> }).context
      const logs = ctx['logs']
      if (Array.isArray(logs) && logs.length > 0) {
        throw new Error(`Transaction simulation failed:\n${(logs as string[]).join('\n')}`)
      }
      const cause = ctx['cause']
      if (cause && typeof cause === 'object' && 'message' in cause) {
        throw new Error(`Transaction simulation failed: ${(cause as { message: string }).message}`)
      }
    }
    throw e
  }
}

/** Poll until a signature is confirmed; throw if the transaction failed on-chain. */
async function confirmSig(rpcUrl: string, sig: string): Promise<void> {
  const rpc = createSolanaRpc(rpcUrl)
  for (let i = 0; i < 60; i++) {
    const { value: [status] } = await rpc
      .getSignatureStatuses([sig as never])
      .send()

    if (status?.err) {
      throw new Error(
        `Transaction failed on-chain: ${JSON.stringify(status.err)}`
      )
    }
    if (
      status?.confirmationStatus === 'confirmed' ||
      status?.confirmationStatus === 'finalized'
    ) {
      return
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Transaction confirmation timed out (15 s)')
}

/** Build + sign + send + confirm in one call. */
async function sendAndConfirm(
  rpcUrl: string,
  payer: KeyPairSigner,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instructions: any[],
): Promise<void> {
  const rpc = createSolanaRpc(rpcUrl)
  const { value: bh } = await rpc.getLatestBlockhash().send()
  const sig = await sendOne(rpcUrl, payer, instructions, bh)
  await confirmSig(rpcUrl, sig)
}

// ---- Main export -----------------------------------------------------------

export interface DeployOptions {
  onProgress?: (msg: string) => void
}

/**
 * Deploys the provided ELF binary to the cluster at `rpcUrl`.
 * `payer` must be pre-funded (use `estimateDeployLamports`).
 * Returns the new program's on-chain address.
 */
export async function deployProgram(
  rpcUrl: string,
  payer: KeyPairSigner,
  elfBytes: Uint8Array,
  { onProgress }: DeployOptions = {},
): Promise<Address> {
  const rpc    = createSolanaRpc(rpcUrl)
  const elfSize = BigInt(elfBytes.length)
  const enc    = getAddressEncoder()

  // Keypairs for the staging buffer and the permanent program account
  const [bufferKeypair, programKeypair] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ])

  // The programdata PDA is derived from the program account's public key
  const [programDataAddress] = await getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE,
    seeds: [enc.encode(programKeypair.address)],
  })

  // ---- Rent calculations ----
  onProgress?.('Calculating rent requirements…')
  const [bufferRent, programRent] = await Promise.all([
    rpc.getMinimumBalanceForRentExemption(BUFFER_METADATA_SIZE + elfSize).send(),
    rpc.getMinimumBalanceForRentExemption(PROGRAM_ACCOUNT_SIZE).send(),
  ])

  // ---- Step 1: Create the staging buffer account ----
  onProgress?.('Step 1/5 — Creating buffer account…')
  await sendAndConfirm(rpcUrl, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: bufferKeypair,
      lamports: bufferRent,
      space: BUFFER_METADATA_SIZE + elfSize,
      programAddress: BPF_LOADER_UPGRADEABLE,
    }),
  ])

  // ---- Step 2: InitializeBuffer — set upgrade authority ----
  onProgress?.('Step 2/5 — Initializing buffer…')
  await sendAndConfirm(rpcUrl, payer, [{
    programAddress: BPF_LOADER_UPGRADEABLE,
    accounts: [
      { address: bufferKeypair.address, role: AccountRole.WRITABLE },
      // authority — readonly (no signer needed per Solana runtime)
      { address: payer.address,         role: AccountRole.READONLY },
    ],
    // variant 0 = InitializeBuffer (bincode u32 LE)
    data: new Uint8Array([0, 0, 0, 0]),
  }])

  // ---- Step 3: Write ELF bytes in chunks ----
  const chunks: Uint8Array[] = []
  for (let i = 0; i < elfBytes.length; i += CHUNK_SIZE) {
    chunks.push(elfBytes.slice(i, i + CHUNK_SIZE))
  }
  onProgress?.(`Step 3/5 — Writing ${chunks.length} chunks…`)

  // Fetch one blockhash for all writes (valid ~60 s; localnet is much faster)
  const { value: writeBh } = await rpc.getLatestBlockhash().send()

  // Pre-sign all write transactions in parallel
  const signedWrites = await Promise.all(
    chunks.map((chunk, i) => {
      const writeIx = {
        programAddress: BPF_LOADER_UPGRADEABLE,
        accounts: [
          { address: bufferKeypair.address, role: AccountRole.WRITABLE },
          // authority must sign for Write
          { address: payer.address,         role: AccountRole.READONLY_SIGNER },
        ],
        // variant 1 = Write; offset: u32 LE; bytes length: u64 LE (Bincode Vec<u8>); bytes
        data: concat(
          u32le(1),
          u32le(i * CHUNK_SIZE),
          u64le(BigInt(chunk.length)),
          chunk,
        ),
      }
      const msg = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(payer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(writeBh, m),
        (m) => appendTransactionMessageInstructions([writeIx], m),
      )
      return signTransactionMessageWithSigners(msg)
    }),
  )

  // Send all writes in batches of 25; collect the last signature for confirmation
  const BATCH = 25
  let lastSig = ''
  for (let i = 0; i < signedWrites.length; i += BATCH) {
    const batch = signedWrites.slice(i, i + BATCH)
    const sigs = await Promise.all(
      batch.map((signed) => {
        const wire = getBase64EncodedWireTransaction(signed)
        return rpc.sendTransaction(wire, { encoding: 'base64' }).send() as Promise<string>
      }),
    )
    lastSig = sigs[sigs.length - 1]
    onProgress?.(`  ${Math.min(i + BATCH, signedWrites.length)}/${chunks.length} chunks sent`)
  }

  // Wait for the last write to confirm before proceeding
  onProgress?.('  Confirming writes…')
  await confirmSig(rpcUrl, lastSig)

  // ---- Step 4: Create the program account (required before DeployWithMaxDataLen) ----
  // The program account must exist, be owned by BPF_LOADER_UPGRADEABLE,
  // and be in Uninitialized state when DeployWithMaxDataLen runs.
  onProgress?.('Step 4/5 — Creating program account…')
  await sendAndConfirm(rpcUrl, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: programKeypair,
      lamports: programRent,
      space: PROGRAM_ACCOUNT_SIZE,
      programAddress: BPF_LOADER_UPGRADEABLE,
    }),
  ])

  // ---- Step 5: DeployWithMaxDataLen ----
  // ELF verification + 77KB+ data copy far exceeds the default 200K CU budget.
  // The Solana CLI requests 1_400_000 CUs for the deploy transaction; we do the same.
  onProgress?.('Step 5/5 — Deploying program…')
  await sendAndConfirm(rpcUrl, payer, [
    setComputeUnitLimitIx(1_400_000),
    {
    programAddress: BPF_LOADER_UPGRADEABLE,
    accounts: [
      // 0: payer (writable, signer) — funds the programdata CPI
      { address: payer.address,          role: AccountRole.WRITABLE_SIGNER },
      // 1: programdata PDA (writable) — created inside this instruction
      { address: programDataAddress,     role: AccountRole.WRITABLE },
      // 2: program account (writable, signer) — must already exist
      { address: programKeypair.address, role: AccountRole.WRITABLE_SIGNER, signer: programKeypair },
      // 3: buffer (writable) — drained into programdata then closed
      { address: bufferKeypair.address,  role: AccountRole.WRITABLE },
      // 4-6: sysvars + system program
      { address: SYSVAR_RENT,            role: AccountRole.READONLY },
      { address: SYSVAR_CLOCK,           role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM,         role: AccountRole.READONLY },
      // 7: upgrade authority (signer)
      { address: payer.address,          role: AccountRole.READONLY_SIGNER },
    ],
    // variant 2 = DeployWithMaxDataLen; max_data_len: usize → u64 LE
    data: concat(u32le(2), u64le(elfSize)),
  },
  ])

  onProgress?.(`Done — program deployed at ${programKeypair.address}`)
  return programKeypair.address
}

// ---- Cost estimate ---------------------------------------------------------

/**
 * Returns the minimum lamports a payer needs to deploy a given ELF binary.
 * Includes buffer rent + programdata rent + program rent + tx fee buffer.
 */
export async function estimateDeployLamports(
  rpcUrl: string,
  elfSize: number,
): Promise<bigint> {
  const rpc = createSolanaRpc(rpcUrl)
  const n   = BigInt(elfSize)
  const [bufRent, pdRent, progRent] = await Promise.all([
    rpc.getMinimumBalanceForRentExemption(BUFFER_METADATA_SIZE + n).send(),
    rpc.getMinimumBalanceForRentExemption(PROGRAMDATA_METADATA_SIZE + n).send(),
    rpc.getMinimumBalanceForRentExemption(PROGRAM_ACCOUNT_SIZE).send(),
  ])
  const txFees = 10_000_000n  // 0.01 SOL to cover ~100 chunk txs + other txs
  return bufRent + pdRent + progRent + txFees
}
