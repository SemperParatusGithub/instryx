import type { AnchorIdl, StoredIdl } from '@/types'

export function parseAndValidateIdl(raw: string): AnchorIdl {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON — could not parse.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('IDL must be a JSON object.')
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.address !== 'string') {
    throw new Error('IDL missing required field: "address" (program ID).')
  }
  if (!Array.isArray(obj.instructions)) {
    throw new Error('IDL missing required field: "instructions" array.')
  }
  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    throw new Error('IDL missing required field: "metadata".')
  }

  return parsed as AnchorIdl
}

export function idlToStoredIdl(idl: AnchorIdl): StoredIdl {
  return {
    id: crypto.randomUUID(),
    name: idl.metadata.name,
    programId: idl.address,
    idl,
    loadedAt: Date.now(),
  }
}

export function getIdlInstructionCount(idl: AnchorIdl): number {
  return idl.instructions.length
}

export function getIdlAccountCount(idl: AnchorIdl): number {
  return idl.accounts?.length ?? 0
}
