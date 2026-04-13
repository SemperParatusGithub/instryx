import { getProgramDerivedAddress, address, getAddressEncoder, getUtf8Encoder } from '@solana/kit'

export type SeedEntry = {
  type: 'string' | 'publicKey' | 'bytes' | 'u8' | 'u64'
  value: string
}

function seedToBytes(seed: SeedEntry): Uint8Array {
  switch (seed.type) {
    case 'string': {
      // getUtf8Encoder returns ReadonlyUint8Array — copy to mutable Uint8Array
      return Uint8Array.from(getUtf8Encoder().encode(seed.value))
    }
    case 'publicKey': {
      return Uint8Array.from(getAddressEncoder().encode(address(seed.value)))
    }
    case 'u8': {
      const n = parseInt(seed.value, 10)
      return new Uint8Array([n & 0xff])
    }
    case 'u64': {
      const buf = new ArrayBuffer(8)
      const view = new DataView(buf)
      view.setBigUint64(0, BigInt(seed.value), true) // little-endian
      return new Uint8Array(buf)
    }
    case 'bytes': {
      // Comma-separated decimals "1,2,3" or hex "0x010203"
      if (seed.value.startsWith('0x') || seed.value.startsWith('0X')) {
        const hex = seed.value.slice(2)
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
        }
        return bytes
      }
      return new Uint8Array(seed.value.split(',').map((b) => parseInt(b.trim(), 10)))
    }
  }
}

export async function derivePda(
  programId: string,
  seeds: SeedEntry[],
): Promise<{ pda: string; bump: number }> {
  const seedBytes = seeds.map(seedToBytes)
  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: address(programId),
    seeds: seedBytes,
  })
  return { pda, bump }
}
