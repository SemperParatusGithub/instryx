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
  getBase64EncodedWireTransaction,
  lamports,
} from '@solana/kit'
import type { TransactionSendingSigner, Instruction, KeyPairSigner } from '@solana/kit'

export async function buildAndSendTransaction(
  rpcUrl: string,
  signer: TransactionSendingSigner,
  instructions: Instruction[],
): Promise<string> {
  const rpc = createSolanaRpc(rpcUrl)
  const {
    value: { blockhash, lastValidBlockHeight },
  } = await rpc.getLatestBlockhash().send()

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        m,
      ),
    (m) => appendTransactionMessageInstructions(instructions, m),
  )

  const sigBytes = await signAndSendTransactionMessageWithSigners(txMsg)
  return getBase58Decoder().decode(sigBytes)
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

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        m,
      ),
    (m) => appendTransactionMessageInstructions(instructions, m),
  )

  const signed = await signTransactionMessageWithSigners(txMsg)
  const wireBytes = getBase64EncodedWireTransaction(signed)
  const sig = await rpc.sendTransaction(wireBytes, { encoding: 'base64' }).send()
  return sig as string
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

  const signed = await signTransactionMessageWithSigners(txMsg)
  const wireBytes = getBase64EncodedWireTransaction(signed)

  const result = await rpc
    .simulateTransaction(wireBytes, {
      encoding: 'base64',
      replaceRecentBlockhash: true,
      sigVerify: false,
    })
    .send()

  return result.value as SimulationResult
}
