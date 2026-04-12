export type Network = 'localnet' | 'devnet' | 'mainnet' | 'custom'

export interface NetworkConfig {
  network: Network
  rpcUrl: string
  wsUrl: string
}

export interface AnchorIdl {
  address: string
  metadata: {
    name: string
    version: string
    spec: string
    description?: string
  }
  instructions: AnchorInstruction[]
  accounts?: AnchorAccountDef[]
  types?: AnchorTypeDef[]
  errors?: AnchorErrorDef[]
  constants?: AnchorConstant[]
  events?: AnchorEventDef[]
}

export interface AnchorInstruction {
  name: string
  discriminator: number[]
  accounts: AnchorInstructionAccount[]
  args: AnchorArg[]
  docs?: string[]
  returns?: string
}

export interface AnchorInstructionAccount {
  name: string
  writable?: boolean
  signer?: boolean
  optional?: boolean
  address?: string
  pda?: AnchorPda
  docs?: string[]
}

export interface AnchorPda {
  seeds: AnchorSeed[]
  program?: { kind: string; value?: string }
}

export interface AnchorSeed {
  kind: 'const' | 'arg' | 'account'
  value?: number[]
  path?: string
  type?: AnchorType
}

export interface AnchorArg {
  name: string
  type: AnchorType
  docs?: string[]
}

export type AnchorType =
  | string
  | { vec: AnchorType }
  | { option: AnchorType }
  | { array: [AnchorType, number] }
  | { defined: { name: string } }

export interface AnchorAccountDef {
  name: string
  discriminator: number[]
}

export interface AnchorTypeDef {
  name: string
  type: {
    kind: 'struct' | 'enum'
    fields?: Array<{ name: string; type: AnchorType }>
    variants?: Array<{ name: string; fields?: Array<{ name: string; type: AnchorType }> }>
  }
  docs?: string[]
}

export interface AnchorErrorDef {
  code: number
  name: string
  msg?: string
}

export interface AnchorConstant {
  name: string
  type: AnchorType
  value: string
}

export interface AnchorEventDef {
  name: string
  discriminator: number[]
  fields: Array<{ name: string; type: AnchorType; index?: boolean }>
}

export interface StoredIdl {
  id: string
  name: string
  programId: string
  idl: AnchorIdl
  loadedAt: number
}

export interface AddressBookEntry {
  id: string
  label: string
  address: string
  note?: string
}

export interface StoredKeypair {
  id: string
  label: string
  publicKey: string
  encryptedSecretKey: string
  createdAt: number
}
