import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signAndSendTransactionMessageWithSigners,
  getBase58Decoder,
  createNoopSigner,
  address,
  signTransactionMessageWithSigners,
  partiallySignTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  lamports,
  AccountRole,
} from '@solana/kit'
import type { TransactionSendingSigner, Instruction, KeyPairSigner } from '@solana/kit'

/**
 * When an IDL instruction marks an account as a signer, @solana/kit requires
 * a signer *object* to be embedded in that account meta — it doesn't infer
 * coverage from the fee-payer signer alone.
 *
 * This helper walks all instruction accounts and, for any that have a signer
 * role but no signer attached, attaches a provided signer whose address matches.
 * Covers the common case: wallet is fee payer AND a required signer account.
 */
function patchSignerAccounts(
  instructions: Instruction[],
  signers: ReadonlyArray<{ readonly address: string }>,
): Instruction[] {
  const byAddr = new Map(signers.map((s) => [s.address, s]))
  return instructions.map((ix) => ({
    ...ix,
    accounts: ix.accounts?.map((acc) => {
      if (
        (acc.role === AccountRole.READONLY_SIGNER ||
          acc.role === AccountRole.WRITABLE_SIGNER) &&
        !('signer' in acc) &&
        byAddr.has(acc.address)
      ) {
        return { ...acc, signer: byAddr.get(acc.address)! }
      }
      return acc
    }),
  }))
}

export async function buildAndSendTransaction(
  rpcUrl: string,
  signer: TransactionSendingSigner,
  instructions: Instruction[],
): Promise<string> {
  const rpc = createSolanaRpc(rpcUrl)
  const {
    value: { blockhash, lastValidBlockHeight },
  } = await rpc.getLatestBlockhash().send()

  const patched = patchSignerAccounts(instructions, [signer])

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        m,
      ),
    (m) => appendTransactionMessageInstructions(patched, m),
  )

  try {
    const sigBytes = await signAndSendTransactionMessageWithSigners(txMsg)
    return getBase58Decoder().decode(sigBytes)
  } catch (e) {
    throw extractRpcError(e)
  }
}

/**
 * Build, sign, and send a transaction using a local keypair as the fee payer.
 * Designed for localnet where no wallet is available: generates a temporary fee payer,
 * airdrops SOL to cover rent + fees, then signs and sends directly via RPC.
 *
 * @param rpcUrl  The RPC endpoint (must support requestAirdrop, e.g. localnet)
 * @param feePayer  A KeyPairSigner that will pay the transaction fee
 * @param instructions  Instructions to include in the transaction
 */
export async function buildAndSendWithKeypairSigner(
  rpcUrl: string,
  feePayer: KeyPairSigner,
  instructions: Instruction[],
): Promise<string> {
  const rpc = createSolanaRpc(rpcUrl)
  const {
    value: { blockhash, lastValidBlockHeight },
  } = await rpc.getLatestBlockhash().send()

  const patched = patchSignerAccounts(instructions, [feePayer])

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        m,
      ),
    (m) => appendTransactionMessageInstructions(patched, m),
  )

  const signed = await signTransactionMessageWithSigners(txMsg)
  const wireBytes = getBase64EncodedWireTransaction(signed)
  try {
    const sig = await rpc.sendTransaction(wireBytes, { encoding: 'base64' }).send()
    return sig as string
  } catch (e) {
    throw extractRpcError(e)
  }
}

/** Extract program logs from a @solana/kit RPC error and re-throw with a useful message. */
function extractRpcError(e: unknown): Error {
  if (e && typeof e === 'object' && 'context' in e) {
    const ctx = (e as { context: Record<string, unknown> }).context
    const logs = ctx['logs']
    if (Array.isArray(logs) && logs.length > 0) {
      return new Error(`Transaction simulation failed:\n${(logs as string[]).join('\n')}`)
    }
    const cause = ctx['cause']
    if (cause && typeof cause === 'object' && 'message' in cause) {
      return new Error(`Transaction simulation failed: ${(cause as { message: string }).message}`)
    }
  }
  return e instanceof Error ? e : new Error(String(e))
}

/**
 * Airdrop SOL to an address on localnet and wait for confirmation (polls up to 5 s).
 */
export async function airdropAndConfirm(
  rpcUrl: string,
  recipientAddress: string,
  solAmount: number,
): Promise<void> {
  const rpc = createSolanaRpc(rpcUrl)
  const lamportAmount = lamports(BigInt(Math.round(solAmount * 1_000_000_000)))
  const sig = await rpc.requestAirdrop(address(recipientAddress), lamportAmount).send()

  for (let i = 0; i < 20; i++) {
    const { value: [status] } = await rpc.getSignatureStatuses([sig]).send()
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  // Proceed even if we couldn't confirm — on localnet it usually lands immediately
}

export type SimulationResult = {
  err: unknown
  logs: readonly string[] | null
  unitsConsumed?: bigint | null
}

export async function simulateInstructions(
  rpcUrl: string,
  feePayer: string,
  instructions: Instruction[],
): Promise<SimulationResult> {
  const rpc = createSolanaRpc(rpcUrl)
  const {
    value: { blockhash, lastValidBlockHeight },
  } = await rpc.getLatestBlockhash().send()

  const noopSigner = createNoopSigner(address(feePayer))

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(noopSigner, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        m,
      ),
    (m) => appendTransactionMessageInstructions(instructions, m),
  )

  // partiallySign (not signTransactionMessageWithSigners) so we skip assertIsFullySignedTransaction.
  // Null signature slots encode as 64 zero bytes — the RPC accepts them with sigVerify: false.
  const signed = await partiallySignTransactionMessageWithSigners(txMsg)
  const wireBytes = getBase64EncodedWireTransaction(signed as Parameters<typeof getBase64EncodedWireTransaction>[0])

  const result = await rpc
    .simulateTransaction(wireBytes, {
      encoding: 'base64',
      replaceRecentBlockhash: true,
      sigVerify: false,
    })
    .send()

  return result.value as SimulationResult
}
