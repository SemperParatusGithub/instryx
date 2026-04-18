import { useState, useCallback, useEffect } from 'react'
import { getProgramDerivedAddress, address as toAddress } from '@solana/kit'
import { Copy, CheckCircle2, Plus, Trash2, ChevronDown, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AccountInput } from '@/features/programs/AccountInput'
import { serializeField, validateField } from '@/lib/solana/serialize'
import type { SchemaField, FieldType } from '@/lib/solana/serialize'

// ---- Seed types supported for PDA derivation --------------------------------
// Each seed is serialized to bytes using the same serialize.ts logic.

const SEED_TYPES: { group: string; types: FieldType[] }[] = [
  { group: 'Unsigned integers', types: ['u8', 'u16', 'u32', 'u64'] },
  { group: 'Signed integers',   types: ['i8', 'i16', 'i32', 'i64'] },
  { group: 'Other',             types: ['string', 'pubkey', 'bytes'] },
]

const SEED_PLACEHOLDERS: Partial<Record<FieldType, string>> = {
  string:  'UTF-8 string seed',
  pubkey:  'base58 public key',
  bytes:   'hex bytes e.g. deadbeef',
}

const SEED_BYTE_HINTS: Partial<Record<FieldType, string>> = {
  u8: '1B', u16: '2B', u32: '4B', u64: '8B',
  i8: '1B', i16: '2B', i32: '4B', i64: '8B',
  pubkey: '32B',
}

function defaultSeedValue(type: FieldType): string {
  if (type === 'pubkey') return ''
  if (type === 'string') return ''
  if (type === 'bytes')  return ''
  return '0'
}

// ---- Seed row ---------------------------------------------------------------

function SeedRow({
  seed,
  index,
  onUpdate,
  onRemove,
}: {
  seed: SchemaField
  index: number
  onUpdate: (patch: Partial<SchemaField>) => void
  onRemove: () => void
}) {
  const error = validateField(seed)
  const hint  = SEED_BYTE_HINTS[seed.type]

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0 w-4">{index + 1}.</span>
        <Badge variant="outline" className="font-mono text-xs shrink-0">{seed.type}</Badge>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {seed.type === 'pubkey' ? (
        <AccountInput
          value={seed.value}
          onChange={(v) => onUpdate({ value: v })}
          placeholder={SEED_PLACEHOLDERS.pubkey}
        />
      ) : (
        <div className="space-y-1">
          <Input
            value={seed.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={SEED_PLACEHOLDERS[seed.type] ?? '0'}
            className="h-7 text-xs font-mono"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ---- Page ------------------------------------------------------------------

export function PdaPage() {
  const [programId, setProgramId] = useState('')
  const [seeds, setSeeds]         = useState<SchemaField[]>([])
  const [pda, setPda]             = useState<string | null>(null)
  const [bump, setBump]           = useState<number | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)

  const addSeed = useCallback((type: FieldType) => {
    setSeeds((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', type, value: defaultSeedValue(type) },
    ])
  }, [])

  const updateSeed = useCallback((id: string, patch: Partial<SchemaField>) => {
    setSeeds((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const removeSeed = useCallback((id: string) => {
    setSeeds((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // Derive PDA whenever inputs change
  useEffect(() => {
    setPda(null)
    setBump(null)
    setError(null)

    if (!programId.trim()) return

    // Validate all seeds have no errors
    const seedErrors = seeds.map(validateField).filter(Boolean)
    if (seedErrors.length > 0) return

    // Serialize each seed to bytes
    const seedBytes: Uint8Array[] = []
    for (const seed of seeds) {
      const bytes = serializeField(seed)
      if (!bytes) return  // invalid field — wait for fix
      seedBytes.push(bytes)
    }

    let cancelled = false
    getProgramDerivedAddress({
      programAddress: toAddress(programId.trim()),
      seeds: seedBytes,
    })
      .then(([derivedAddress, derivedBump]) => {
        if (cancelled) return
        setPda(derivedAddress)
        setBump(derivedBump)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })

    return () => { cancelled = true }
  }, [programId, seeds])

  const handleCopy = () => {
    if (!pda) return
    navigator.clipboard.writeText(pda).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">PDA Deriver</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Derive a Program Derived Address from a program ID and seeds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left — inputs */}
        <div className="space-y-5">
          {/* Program ID */}
          <div className="space-y-1.5">
            <Label>Program ID</Label>
            <AccountInput
              value={programId}
              onChange={setProgramId}
              placeholder="Program public key…"
            />
          </div>

          {/* Seeds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Seeds</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Plus className="size-3" />
                    Add Seed
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {SEED_TYPES.map(({ group, types }) => (
                    <div key={group}>
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        {group}
                      </DropdownMenuLabel>
                      {types.map((t) => (
                        <DropdownMenuItem
                          key={t}
                          onClick={() => addSeed(t)}
                          className="font-mono text-xs"
                        >
                          {t}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {seeds.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                No seeds — the PDA will be derived from the program ID only
              </div>
            ) : (
              <div className="space-y-2">
                {seeds.map((seed, i) => (
                  <SeedRow
                    key={seed.id}
                    seed={seed}
                    index={i}
                    onUpdate={(patch) => updateSeed(seed.id, patch)}
                    onRemove={() => removeSeed(seed.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — result */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-primary" />
            <h2 className="text-sm font-medium">Derived Address</h2>
          </div>

          {!programId.trim() ? (
            <p className="text-xs text-muted-foreground">
              Enter a Program ID to derive the PDA.
            </p>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : pda ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">PDA</p>
                <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2.5">
                  <span className="font-mono text-xs flex-1 break-all">{pda}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={handleCopy}
                  >
                    {copied
                      ? <CheckCircle2 className="size-3.5 text-green-500" />
                      : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Bump</p>
                  <span className="font-mono text-sm">{bump}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Seeds</p>
                  <span className="font-mono text-sm">{seeds.length}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Deriving…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
