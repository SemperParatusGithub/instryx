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
} from '@solana/kit'
import type { TransactionSendingSigner, Instruction } from '@solana/kit'

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
