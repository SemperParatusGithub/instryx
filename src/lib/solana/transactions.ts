import type { AnchorIdl, AnchorInstruction, AnchorType } from '@/types'
import type { Instruction } from '@solana/kit'
import { address, AccountRole } from '@solana/kit'

/**
 * Coerce a raw form value (always a string/boolean coming from <input>) into
 * the type expected by @coral-xyz/anchor's BorshCoder:
 *   - u64/i64/u128/i128 → BN  (coder calls .toArrayLike on these)
 *   - u8–u32 / i8–i32  → number
 *   - f32/f64          → number
 *   - bool             → boolean (Switch already gives boolean, guard anyway)
 *   - everything else  → unchanged
 */
async function coerceArg(value: unknown, type: AnchorType): Promise<unknown> {
  if (typeof type !== 'string') return value
  switch (type) {
    case 'u64':
    case 'i64':
    case 'u128':
    case 'i128': {
      const { BN } = await import('@coral-xyz/anchor')
      return new BN(String(value ?? '0'))
    }
    case 'u8':
    case 'i8':
    case 'u16':
    case 'i16':
    case 'u32':
    case 'i32':
    case 'f32':
    case 'f64':
      return Number(value ?? 0)
    case 'bool':
      return Boolean(value)
    default:
      return value
  }
}

export async function buildAnchorInstruction(params: {
  idl: AnchorIdl
  instruction: AnchorInstruction
  args: Record<string, unknown>
  accounts: Record<string, string>
}): Promise<Instruction> {
  const { BorshCoder } = await import('@coral-xyz/anchor')
  const coder = new BorshCoder(params.idl as never)

  // Coerce each arg from its raw form value to the type BorshCoder expects
  const coercedArgs: Record<string, unknown> = {}
  for (const argDef of params.instruction.args) {
    coercedArgs[argDef.name] = await coerceArg(params.args[argDef.name], argDef.type)
  }

  const encoded = coder.instruction.encode(params.instruction.name, coercedArgs)
  const data = new Uint8Array(encoded)

  const accounts = params.instruction.accounts.map((acc) => ({
    address: address(params.accounts[acc.name] ?? params.idl.address),
    role: acc.writable && acc.signer
      ? AccountRole.WRITABLE_SIGNER  // 3
      : acc.writable
        ? AccountRole.WRITABLE        // 1
        : acc.signer
          ? AccountRole.READONLY_SIGNER // 2
          : AccountRole.READONLY,       // 0
  }))

  return {
    programAddress: address(params.idl.address),
    accounts,
    data,
  }
}
