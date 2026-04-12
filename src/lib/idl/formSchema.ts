import { z } from 'zod'
import type { AnchorType } from '@/types'

/** Map an Anchor type to a Zod schema for form validation */
export function anchorTypeToZod(type: AnchorType): z.ZodTypeAny {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':
        return z.boolean()
      case 'u8':
      case 'i8':
      case 'u16':
      case 'i16':
      case 'u32':
      case 'i32':
        return z.string().regex(/^-?\d+$/, 'Must be an integer')
      case 'u64':
      case 'i64':
      case 'u128':
      case 'i128':
        return z.string().regex(/^-?\d+$/, 'Must be an integer (big number)')
      case 'f32':
      case 'f64':
        return z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a number')
      case 'pubkey':
      case 'publicKey':
        return z
          .string()
          .min(32, 'Invalid public key')
          .max(44, 'Invalid public key')
      case 'string':
        return z.string()
      case 'bytes':
        return z.string() // comma-separated numbers or hex
      default:
        return z.string()
    }
  }

  if ('vec' in type) {
    return z.string() // JSON array input
  }
  if ('option' in type) {
    return z.string().optional().or(z.literal(''))
  }
  if ('array' in type) {
    return z.string() // JSON array input
  }
  if ('defined' in type) {
    return z.string() // JSON object input
  }

  return z.string()
}

/** Human-readable label for an Anchor type */
export function anchorTypeLabel(type: AnchorType): string {
  if (typeof type === 'string') return type
  if ('vec' in type) return `Vec<${anchorTypeLabel(type.vec)}>`
  if ('option' in type) return `Option<${anchorTypeLabel(type.option)}>`
  if ('array' in type) return `[${anchorTypeLabel(type.array[0])}; ${type.array[1]}]`
  if ('defined' in type) return type.defined.name
  return 'unknown'
}

/** Returns the HTML input type for a given Anchor type */
export function anchorTypeInputType(type: AnchorType): 'text' | 'number' | 'checkbox' {
  if (typeof type === 'string') {
    if (type === 'bool') return 'checkbox'
    if (['u8','i8','u16','i16','u32','i32','f32','f64'].includes(type)) return 'number'
  }
  return 'text'
}
