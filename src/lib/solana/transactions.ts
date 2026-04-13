import type { AnchorIdl, AnchorInstruction } from '@/types'
import type { Instruction } from '@solana/kit'
import { address } from '@solana/kit'

export async function buildAnchorInstruction(params: {
  idl: AnchorIdl
  instruction: AnchorInstruction
  args: Record<string, unknown>
  accounts: Record<string, string>
}): Promise<Instruction> {
  const { BorshCoder } = await import('@coral-xyz/anchor')
  const coder = new BorshCoder(params.idl as never)

  const encoded = coder.instruction.encode(params.instruction.name, params.args)
  const data = new Uint8Array(encoded)

  const accounts = params.instruction.accounts.map((acc) => ({
    address: address(params.accounts[acc.name] ?? params.idl.address),
    role: (acc.writable && acc.signer
      ? 3
      : acc.writable
        ? 2
        : acc.signer
          ? 1
          : 0) as 0 | 1 | 2 | 3,
  }))

  return {
    programAddress: address(params.idl.address),
    accounts,
    data,
  }
}
