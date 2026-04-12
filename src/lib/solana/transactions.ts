import {
  createSolanaRpc,
  address,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  getBase64EncodedWireTransaction,
  pipe,
} from '@solana/kit'
import type { AnchorIdl, AnchorInstruction } from '@/types'

/** Build a raw instruction buffer using Anchor's discriminator + encoded args */
export async function buildAnchorInstruction(params: {
  idl: AnchorIdl
  instruction: AnchorInstruction
  args: Record<string, unknown>
  accounts: Record<string, string>
  feePayer: string
}): Promise<{
  programId: string
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
  data: Uint8Array
}> {
  const { BorshCoder } = await import('@coral-xyz/anchor')
  const coder = new BorshCoder(params.idl as never)

  const encoded = coder.instruction.encode(params.instruction.name, params.args)
  const data = new Uint8Array(encoded)

  const keys = params.instruction.accounts.map((acc) => ({
    pubkey: params.accounts[acc.name] ?? '',
    isSigner: acc.signer ?? false,
    isWritable: acc.writable ?? false,
  }))

  return { programId: params.idl.address, keys, data }
}

export async function simulateTransaction(
  rpcUrl: string,
  feePayer: string,
  programId: string,
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>,
  data: Uint8Array,
) {
  const rpc = createSolanaRpc(rpcUrl)

  const { value: blockhash } = await rpc.getLatestBlockhash().send()

  const ixAccounts = keys.map((k) => ({
    address: address(k.pubkey),
    role: (k.isWritable && k.isSigner
      ? 3
      : k.isWritable
        ? 2
        : k.isSigner
          ? 1
          : 0) as 0 | 1 | 2 | 3,
  }))

  const ix = {
    programAddress: address(programId),
    accounts: ixAccounts,
    data,
  }

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(feePayer), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  )

  const compiled = compileTransaction(txMsg)
  const wireBytes = getBase64EncodedWireTransaction(compiled)

  const simResult = await rpc
    .simulateTransaction(wireBytes, {
      encoding: 'base64',
      replaceRecentBlockhash: true,
      sigVerify: false,
    })
    .send()

  return simResult.value
}
