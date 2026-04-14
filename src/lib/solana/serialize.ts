import bs58 from 'bs58'

// ---- Types ----------------------------------------------------------------

export type IntFieldType = 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64'
export type FieldType = IntFieldType | 'bool' | 'pubkey' | 'string' | 'bytes'

export interface SchemaField {
  id: string
  name: string
  type: FieldType
  value: string
  /** For 'string': max bytes to allocate (default 32). For 'bytes': ignored (length = hex input). */
  maxLength?: number
}

/** Returns how many bytes this field occupies in the serialized buffer. */
export function fieldByteSize(field: SchemaField): number {
  switch (field.type) {
    case 'u8':  case 'i8':  case 'bool': return 1
    case 'u16': case 'i16':              return 2
    case 'u32': case 'i32':              return 4
    case 'u64': case 'i64':              return 8
    case 'pubkey':                       return 32
    case 'string':
      // Borsh format: u32 length prefix (4 bytes) + up to maxLength UTF-8 bytes
      return 4 + (field.maxLength ?? 32)
    case 'bytes': {
      const hex = field.value.replace(/\s/g, '').replace(/^0x/, '')
      return Math.floor(hex.length / 2)
    }
  }
}

/** Returns a human-readable size label for a field type. */
export function fieldTypeLabel(type: FieldType): string {
  switch (type) {
    case 'u8': return 'u8 (1 byte)'
    case 'u16': return 'u16 (2 bytes)'
    case 'u32': return 'u32 (4 bytes)'
    case 'u64': return 'u64 (8 bytes)'
    case 'i8': return 'i8 (1 byte)'
    case 'i16': return 'i16 (2 bytes)'
    case 'i32': return 'i32 (4 bytes)'
    case 'i64': return 'i64 (8 bytes)'
    case 'bool': return 'bool (1 byte)'
    case 'pubkey': return 'pubkey (32 bytes)'
    case 'string': return 'string (borsh)'
    case 'bytes': return 'bytes (hex)'
  }
}

/** Default placeholder value for a new field. */
export function defaultValue(type: FieldType): string {
  switch (type) {
    case 'u8': case 'u16': case 'u32': case 'u64': return '0'
    case 'i8': case 'i16': case 'i32': case 'i64': return '0'
    case 'bool': return 'false'
    case 'pubkey': return '11111111111111111111111111111111'
    case 'string': return ''
    case 'bytes': return '00'
  }
}

// ---- Validation -----------------------------------------------------------

/** Returns null if the value is valid, or an error string if not. */
export function validateField(field: SchemaField): string | null {
  try {
    switch (field.type) {
      case 'u8': {
        const n = parseInt(field.value)
        if (isNaN(n) || n < 0 || n > 255) return 'Must be 0–255'
        break
      }
      case 'u16': {
        const n = parseInt(field.value)
        if (isNaN(n) || n < 0 || n > 65535) return 'Must be 0–65535'
        break
      }
      case 'u32': {
        const n = parseInt(field.value)
        if (isNaN(n) || n < 0 || n > 4294967295) return 'Must be 0–4294967295'
        break
      }
      case 'u64': {
        const n = BigInt(field.value || '0')
        if (n < 0n || n > 18446744073709551615n) return 'Must be 0–2^64-1'
        break
      }
      case 'i8': {
        const n = parseInt(field.value)
        if (isNaN(n) || n < -128 || n > 127) return 'Must be −128 to 127'
        break
      }
      case 'i16': {
        const n = parseInt(field.value)
        if (isNaN(n) || n < -32768 || n > 32767) return 'Must be −32768 to 32767'
        break
      }
      case 'i32': {
        const n = parseInt(field.value)
        if (isNaN(n) || n < -2147483648 || n > 2147483647) return 'Must be −2^31 to 2^31−1'
        break
      }
      case 'i64': {
        const n = BigInt(field.value || '0')
        if (n < -9223372036854775808n || n > 9223372036854775807n) return 'Must be −2^63 to 2^63−1'
        break
      }
      case 'bool': {
        if (field.value !== 'true' && field.value !== 'false') return 'Must be true or false'
        break
      }
      case 'pubkey': {
        const decoded = bs58.decode(field.value)
        if (decoded.length !== 32) return 'Must be a valid 32-byte base58 public key'
        break
      }
      case 'string': break  // any string is valid
      case 'bytes': {
        const hex = field.value.replace(/\s/g, '').replace(/^0x/, '')
        if (!/^[0-9a-fA-F]*$/.test(hex)) return 'Must be valid hex'
        if (hex.length % 2 !== 0) return 'Hex must have an even number of characters'
        break
      }
    }
    return null
  } catch {
    return 'Invalid value'
  }
}

// ---- Serialization --------------------------------------------------------

/** Serializes a single field to bytes. Returns null if the value is invalid. */
export function serializeField(field: SchemaField): Uint8Array | null {
  if (validateField(field) !== null) return null

  try {
    const size = fieldByteSize(field)
    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    const bytes = new Uint8Array(buf)

    switch (field.type) {
      case 'u8':  view.setUint8(0, parseInt(field.value || '0')); break
      case 'u16': view.setUint16(0, parseInt(field.value || '0'), true); break
      case 'u32': view.setUint32(0, parseInt(field.value || '0'), true); break
      case 'u64': view.setBigUint64(0, BigInt(field.value || '0'), true); break
      case 'i8':  view.setInt8(0, parseInt(field.value || '0')); break
      case 'i16': view.setInt16(0, parseInt(field.value || '0'), true); break
      case 'i32': view.setInt32(0, parseInt(field.value || '0'), true); break
      case 'i64': view.setBigInt64(0, BigInt(field.value || '0'), true); break
      case 'bool': view.setUint8(0, field.value === 'true' ? 1 : 0); break
      case 'pubkey': {
        bytes.set(bs58.decode(field.value))
        break
      }
      case 'string': {
        const maxLen = field.maxLength ?? 32
        const encoded = new TextEncoder().encode(field.value || '')
        const content = encoded.slice(0, maxLen)
        view.setUint32(0, content.length, true)   // Borsh: u32 LE length prefix
        bytes.set(content, 4)
        break
      }
      case 'bytes': {
        const hex = field.value.replace(/\s/g, '').replace(/^0x/, '')
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
        }
        break
      }
    }

    return bytes
  } catch {
    return null
  }
}

/** Serializes all fields into a single contiguous byte buffer. */
export function serializeSchema(fields: SchemaField[]): Uint8Array | null {
  const parts: Uint8Array[] = []
  for (const field of fields) {
    const b = serializeField(field)
    if (b === null) return null
    parts.push(b)
  }
  const total = parts.reduce((s, p) => s + p.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    result.set(p, offset)
    offset += p.length
  }
  return result
}

/** Returns a hex string representation of bytes for display. */
export function toHexDisplay(bytes: Uint8Array, groupSize = 1): string {
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += groupSize) {
    const group = bytes.slice(i, i + groupSize)
    parts.push(Array.from(group).map((b) => b.toString(16).padStart(2, '0')).join(''))
  }
  return parts.join(' ')
}
