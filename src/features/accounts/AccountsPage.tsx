import { useState, useCallback, useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import { createSolanaRpc, address, generateKeyPairSigner, lamports, AccountRole } from '@solana/kit'
import type { KeyPairSigner } from '@solana/kit'
import { getCreateAccountInstruction } from '@solana-program/system'
import { getTransferSolInstruction } from '@solana-program/system'
import { toast } from 'sonner'
import {
  Search,
  BookMarked,
  Trash2,
  Copy,
  CheckCircle2,
  Plus,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  type SchemaField,
  type FieldType,
  fieldByteSize,
  fieldTypeLabel,
  defaultValue,
  validateField,
  serializeSchema,
  toHexDisplay,
} from '@/lib/solana/serialize'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useNetworkStore } from '@/stores/networkStore'
import { useAddressBookStore } from '@/stores/addressBookStore'
import { useIdlStore } from '@/stores/idlStore'
import { useWalletContext } from '@/features/wallet/useWalletContext'
import { fetchAccount, lamportsToSol, formatBytes } from '@/lib/solana/accounts'
import { buildAndSendTransaction, buildAndSendWithKeypairSigner, airdropAndConfirm } from '@/lib/solana/sendTransaction'
import { useDataWriterProgram } from '@/lib/solana/useDataWriterProgram'

// ---- helpers ----

type AccountInfo = {
  lamports: bigint
  owner: string
  executable: boolean
  rentEpoch: bigint
  data: [string, string]
}

function explorerUrl(addr: string, network: string) {
  const cluster =
    network === 'mainnet' ? '' : network === 'devnet' ? '?cluster=devnet' :
    network === 'localnet' ? '?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899' : '?cluster=devnet'
  return `https://explorer.solana.com/address/${addr}${cluster}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button variant="ghost" size="icon" className="size-6"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
      {copied ? <CheckCircle2 className="size-3 text-green-500" /> : <Copy className="size-3" />}
    </Button>
  )
}

// ---- Account View ----

function AccountView({ account, addr, network }: { account: AccountInfo; addr: string; network: string }) {
  const dataBytes = account.data[0] ? atob(account.data[0]).length : 0
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Lamports</p>
          <div className="flex items-center gap-1">
            <span className="font-mono font-medium">{account.lamports.toLocaleString()}</span>
            <Badge variant="secondary">{lamportsToSol(account.lamports)} SOL</Badge>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Data Size</p>
          <span className="font-mono font-medium">{formatBytes(dataBytes)}</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Owner</p>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs truncate">{account.owner}</span>
            <CopyButton text={account.owner} />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Executable</p>
          <Badge variant={account.executable ? 'default' : 'secondary'}>
            {account.executable ? 'Yes' : 'No'}
          </Badge>
        </div>
      </div>
      {account.data[0] && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Raw Data (base64)</p>
          <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
            {account.data[0]}
          </pre>
        </div>
      )}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
        <span className="font-mono truncate">{addr}</span>
        <CopyButton text={addr} />
        <a href={explorerUrl(addr, network)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary hover:underline">
          <ExternalLink className="size-3" /> Explorer
        </a>
      </div>
    </div>
  )
}

// ---- Decode Account Data ----

function DecodePanel({ account }: { account: AccountInfo; addr: string }) {
  const { getActiveIdl } = useIdlStore()
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null)
  const [decoding, setDecoding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decode = useCallback(async () => {
    const stored = getActiveIdl()
    if (!stored) { toast.error('No IDL loaded'); return }
    setDecoding(true)
    setError(null)
    try {
      const { BorshAccountsCoder } = await import('@coral-xyz/anchor')
      const coder = new BorshAccountsCoder(stored.idl as never)
      const rawBytes = Uint8Array.from(atob(account.data[0]), (c) => c.charCodeAt(0))
      // Try each account type in the IDL
      let result: Record<string, unknown> | null = null
      for (const accDef of stored.idl.accounts ?? []) {
        try {
          result = coder.decode(accDef.name, Buffer.from(rawBytes))
          break
        } catch {
          // try next
        }
      }
      if (result) {
        setDecoded(result)
      } else {
        setError('Could not match account data to any IDL account type.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDecoding(false)
    }
  }, [account.data, getActiveIdl])

  if (!account.data[0]) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={decode} disabled={decoding}>
          {decoding && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
          Decode with IDL
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      {decoded && (
        <pre className="text-xs font-mono bg-muted p-2 rounded max-h-64 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(decoded, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
        </pre>
      )}
    </div>
  )
}

// ---- Create Account ----

const SYSTEM_PROGRAM = '11111111111111111111111111111111'

function FieldRow({
  field,
  onUpdate,
  onRemove,
}: {
  field: SchemaField
  onUpdate: (patch: Partial<SchemaField>) => void
  onRemove: () => void
}) {
  const error = validateField(field)
  const size = fieldByteSize(field)

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs shrink-0">{field.type}</Badge>
        <Input
          placeholder="Field name (optional)"
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-7 text-xs"
        />
        <span className="text-xs text-muted-foreground shrink-0">{size}B</span>
        <Button variant="ghost" size="icon" className="size-6 text-destructive shrink-0" onClick={onRemove}>
          <Trash2 className="size-3" />
        </Button>
      </div>

      {field.type === 'bool' ? (
        <div className="flex gap-2">
          <Button variant={field.value === 'true' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => onUpdate({ value: 'true' })}>true</Button>
          <Button variant={field.value === 'false' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => onUpdate({ value: 'false' })}>false</Button>
        </div>
      ) : field.type === 'string' ? (
        <div className="flex gap-2 items-start">
          <div className="flex-1 space-y-1">
            <Input placeholder="String value" value={field.value} onChange={(e) => onUpdate({ value: e.target.value })} className="h-7 text-xs font-mono" />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">max</span>
            <Input type="number" min="1" max="1024" value={field.maxLength ?? 32} onChange={(e) => onUpdate({ maxLength: Math.max(1, parseInt(e.target.value) || 32) })} className="h-7 w-16 text-xs" />
            <span className="text-xs text-muted-foreground">B</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            placeholder={field.type === 'bytes' ? 'hex e.g. deadbeef' : field.type === 'pubkey' ? 'base58 pubkey' : '0'}
            value={field.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="h-7 text-xs font-mono"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

function CreateAccountPanel() {
  const uid = useId()
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { signer } = useWalletContext()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl
  const { addEntry } = useAddressBookStore()
  const isLocalnet = network === 'localnet'

  // Shared
  const [accountName, setAccountName] = useState('')
  const [saveToBook, setSaveToBook] = useState(false)
  const [newAcctSigner, setNewAcctSigner] = useState<KeyPairSigner | null>(null)
  const [generatingKeypair, setGeneratingKeypair] = useState(false)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ address: string; sig: string } | null>(null)

  // Empty-account mode
  const [ownerProgram, setOwnerProgram] = useState('11111111111111111111111111111111')
  const [spaceBytes, setSpaceBytes] = useState('0')
  const [customLamports, setCustomLamports] = useState('')
  const [rentExempt, setRentExempt] = useState<bigint | null>(null)
  const [loadingRent, setLoadingRent] = useState(false)

  // Data mode
  const [fields, setFields] = useState<SchemaField[]>([])
  const [useCustomProgram, setUseCustomProgram] = useState(false)
  const [customProgramId, setCustomProgramId] = useState('')
  const autoProgram = useDataWriterProgram(activeRpcUrl, isLocalnet)

  const hasData = fields.length > 0
  const resolvedProgramId = (useCustomProgram || !isLocalnet) ? customProgramId.trim() : (autoProgram.programId ?? '')
  const serialized = serializeSchema(fields)
  const totalBytes = serialized?.length ?? 0
  const hasErrors = fields.some((f) => validateField(f) !== null)

  const generateKeypair = useCallback(async () => {
    setGeneratingKeypair(true)
    try { setNewAcctSigner(await generateKeyPairSigner()) }
    finally { setGeneratingKeypair(false) }
  }, [])
  useEffect(() => { generateKeypair() }, [generateKeypair])

  const fetchRent = useCallback(async () => {
    setLoadingRent(true)
    try {
      setRentExempt(await createSolanaRpc(activeRpcUrl).getMinimumBalanceForRentExemption(BigInt(spaceBytes)).send())
    } catch (e) {
      toast.error('Failed to fetch rent: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoadingRent(false) }
  }, [activeRpcUrl, spaceBytes])
  useEffect(() => { if (!hasData) fetchRent() }, [fetchRent, hasData])

  const addField = useCallback((type: FieldType) => {
    setFields((prev) => [...prev, { id: `${uid}-${Date.now()}-${Math.random()}`, name: '', type, value: defaultValue(type), ...(type === 'string' ? { maxLength: 32 } : {}) }])
  }, [uid])
  const updateField = useCallback((id: string, patch: Partial<SchemaField>) => {
    setFields((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f))
  }, [])
  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const programReady = hasData
    ? (isLocalnet && !useCustomProgram ? autoProgram.status === 'ready' : !!resolvedProgramId)
    : true
  const canCreate = !creating && !hasErrors && !!newAcctSigner && programReady && (isLocalnet || !!signer)

  const create = useCallback(async () => {
    if (!newAcctSigner) { toast.error('Generate a keypair first'); return }
    if (!isLocalnet && !signer) { toast.error('Connect a wallet first'); return }

    setCreating(true)
    setResult(null)
    try {
      let sig: string
      const newAddr = newAcctSigner.address

      if (!hasData) {
        // Empty account via System Program
        const lamportAmount = customLamports ? lamports(BigInt(customLamports)) : lamports(rentExempt ?? 0n)
        if (isLocalnet) {
          const { generateKeyPairSigner: mkSigner } = await import('@solana/kit')
          const tempFeePayer = await mkSigner()
          toast.info('Requesting airdrop for fee payer…')
          await airdropAndConfirm(activeRpcUrl, tempFeePayer.address, Number(lamportAmount) / 1e9 + 0.01)
          sig = await buildAndSendWithKeypairSigner(activeRpcUrl, tempFeePayer, [
            getCreateAccountInstruction({ payer: tempFeePayer, newAccount: newAcctSigner, lamports: lamportAmount, space: BigInt(spaceBytes), programAddress: address(ownerProgram) }),
          ])
        } else {
          sig = await buildAndSendTransaction(activeRpcUrl, signer!, [
            getCreateAccountInstruction({ payer: signer!, newAccount: newAcctSigner, lamports: lamportAmount, space: BigInt(spaceBytes), programAddress: address(ownerProgram) }),
          ])
        }
      } else {
        // Data account via data-writer program
        if (!resolvedProgramId) { toast.error('Program not ready yet'); return }
        const data = serialized
        if (!data) { toast.error('Fix field errors before creating'); return }
        if (isLocalnet) {
          const tempFeePayer = await generateKeyPairSigner()
          const rent = await createSolanaRpc(activeRpcUrl).getMinimumBalanceForRentExemption(BigInt(data.length)).send()
          toast.info('Requesting airdrop for fee payer…')
          await airdropAndConfirm(activeRpcUrl, tempFeePayer.address, Number(rent) / 1e9 + 0.01)
          sig = await buildAndSendWithKeypairSigner(activeRpcUrl, tempFeePayer, [{
            programAddress: address(resolvedProgramId),
            accounts: [
              { address: tempFeePayer.address,    role: AccountRole.WRITABLE_SIGNER, signer: tempFeePayer },
              { address: newAcctSigner.address,   role: AccountRole.WRITABLE_SIGNER, signer: newAcctSigner },
              { address: address(SYSTEM_PROGRAM), role: AccountRole.READONLY },
            ],
            data,
          } as never])
        } else {
          sig = await buildAndSendTransaction(activeRpcUrl, signer!, [{
            programAddress: address(resolvedProgramId),
            accounts: [
              { address: signer!.address,         role: AccountRole.WRITABLE_SIGNER },
              { address: newAcctSigner.address,   role: AccountRole.WRITABLE_SIGNER, signer: newAcctSigner },
              { address: address(SYSTEM_PROGRAM), role: AccountRole.READONLY },
            ],
            data,
          } as never])
        }
      }

      setResult({ address: newAddr, sig })
      if (saveToBook) addEntry({ label: accountName.trim() || newAddr, address: newAddr })
      toast.success('Account created!')
      generateKeypair()
    } catch (e) {
      toast.error('Failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setCreating(false)
    }
  }, [accountName, activeRpcUrl, addEntry, customLamports, generateKeypair, hasData, isLocalnet, newAcctSigner, ownerProgram, rentExempt, resolvedProgramId, saveToBook, serialized, signer, spaceBytes])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Account</CardTitle>
        <CardDescription>
          Allocate a new on-chain account. Add data fields to write a custom byte layout into the account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* New account address */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>New Account Address</Label>
            {isLocalnet && <Badge variant="secondary" className="text-xs font-normal">No wallet required on localnet</Badge>}
          </div>
          <div className="flex gap-2">
            <Input readOnly value={newAcctSigner?.address ?? ''} placeholder="Generating…" className="font-mono text-xs" />
            <Button variant="outline" size="icon" className="shrink-0" onClick={generateKeypair} disabled={generatingKeypair} title="Generate new keypair">
              {generatingKeypair ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            {newAcctSigner && <CopyButton text={newAcctSigner.address} />}
          </div>
        </div>

        {/* Optional name */}
        <div className="space-y-1.5">
          <Label>Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. My data account" className="text-sm" />
        </div>

        {/* Data fields */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Data <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex items-center gap-2">
              {hasData && <span className="text-xs text-muted-foreground">{totalBytes} bytes</span>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Plus className="size-3" />Add Field<ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Unsigned integers</DropdownMenuLabel>
                  {(['u8', 'u16', 'u32', 'u64'] as FieldType[]).map((t) => (
                    <DropdownMenuItem key={t} onClick={() => addField(t)} className="font-mono text-xs">
                      {t}<span className="ml-auto pl-4 text-muted-foreground">{fieldTypeLabel(t)}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Signed integers</DropdownMenuLabel>
                  {(['i8', 'i16', 'i32', 'i64'] as FieldType[]).map((t) => (
                    <DropdownMenuItem key={t} onClick={() => addField(t)} className="font-mono text-xs">
                      {t}<span className="ml-auto pl-4 text-muted-foreground">{fieldTypeLabel(t)}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Other</DropdownMenuLabel>
                  {(['bool', 'pubkey', 'string', 'bytes'] as FieldType[]).map((t) => (
                    <DropdownMenuItem key={t} onClick={() => addField(t)} className="font-mono text-xs">
                      {t}<span className="ml-auto pl-4 text-muted-foreground">{fieldTypeLabel(t)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {!hasData ? (
            <div className="rounded-md border border-dashed py-5 text-center text-xs text-muted-foreground">
              No data — an empty account will be created. Click "Add Field" to write a custom byte layout.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <FieldRow key={field.id} field={field} onUpdate={(patch) => updateField(field.id, patch)} onRemove={() => removeField(field.id)} />
              ))}
              {serialized && (
                <div className="rounded-md bg-muted p-2">
                  <p className="text-xs text-muted-foreground mb-1">Hex preview ({totalBytes} bytes)</p>
                  <pre className="text-xs font-mono break-all whitespace-pre-wrap text-foreground/80">{toHexDisplay(serialized)}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Program section — only shown when writing data */}
        {hasData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Program</Label>
              {isLocalnet && (
                <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2" onClick={() => setUseCustomProgram((v) => !v)}>
                  {useCustomProgram ? '← Use auto-deployed program' : 'Use custom program ID →'}
                </button>
              )}
            </div>
            {isLocalnet && !useCustomProgram ? (
              <div className={`rounded-md border p-3 text-xs flex items-start gap-2 ${
                autoProgram.status === 'ready'  ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' :
                autoProgram.status === 'error'  ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                                                  'border-border bg-muted/40 text-muted-foreground'
              }`}>
                {(autoProgram.status === 'checking' || autoProgram.status === 'deploying') && <Loader2 className="size-3.5 animate-spin shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  {autoProgram.status === 'idle'     && 'Waiting for localnet connection…'}
                  {autoProgram.status === 'checking' && 'Checking for existing deployment…'}
                  {autoProgram.status === 'deploying' && (autoProgram.progress || 'Deploying program…')}
                  {autoProgram.status === 'ready'    && <span>Ready — <span className="font-mono">{autoProgram.programId}</span></span>}
                  {autoProgram.status === 'error'    && <span>Deploy failed: {autoProgram.error}<button className="ml-2 underline" onClick={autoProgram.deploy}>Retry</button></span>}
                </div>
              </div>
            ) : (
              <Input placeholder="Program address (e.g. instryx-data-writer or your own)" value={customProgramId} onChange={(e) => setCustomProgramId(e.target.value)} className="font-mono text-xs" />
            )}
          </div>
        )}

        {/* Empty-account parameters — only shown when no data fields */}
        {!hasData && (
          <>
            <div className="space-y-1.5">
              <Label>Owner Program</Label>
              <Input value={ownerProgram} onChange={(e) => setOwnerProgram(e.target.value)} placeholder="Program ID that will own this account" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Space (bytes)</Label>
              <div className="flex gap-2">
                <Input type="number" min="0" value={spaceBytes} onChange={(e) => setSpaceBytes(e.target.value)} />
                <Button variant="outline" onClick={fetchRent} disabled={loadingRent}>
                  {loadingRent && <Loader2 className="size-4 animate-spin mr-1" />}
                  Get Rent
                </Button>
              </div>
              {rentExempt !== null && (
                <p className="text-xs text-muted-foreground">
                  Rent-exempt minimum: <span className="font-mono">{rentExempt.toLocaleString()} lamports ({lamportsToSol(rentExempt)} SOL)</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Lamports <span className="text-muted-foreground font-normal">(leave blank for rent-exempt minimum)</span></Label>
              <Input type="number" placeholder={rentExempt !== null ? rentExempt.toString() : 'auto'} value={customLamports} onChange={(e) => setCustomLamports(e.target.value)} />
            </div>
          </>
        )}

        {/* Save to address book */}
        <div className="flex items-center gap-2">
          <Switch id="save-to-book" checked={saveToBook} onCheckedChange={setSaveToBook} />
          <Label htmlFor="save-to-book" className="cursor-pointer font-normal text-sm">Save to address book</Label>
        </div>

        {/* Submit */}
        <div className="space-y-2">
          {isLocalnet ? (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-400">
              On localnet, a temporary fee payer is auto-funded via airdrop — no wallet needed.
            </div>
          ) : !signer ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
              A connected wallet is required to pay the rent-exempt deposit.
            </div>
          ) : null}
          <Button onClick={create} disabled={!canCreate}>
            {creating && <Loader2 className="size-4 animate-spin mr-2" />}
            {hasData ? `Create Account (${totalBytes} bytes)` : 'Create Account'}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-md bg-muted p-3 space-y-1 text-xs">
            <p className="text-green-500 font-medium">Account created!</p>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Address:</span>
              <span className="font-mono truncate">{result.address}</span>
              <CopyButton text={result.address} />
            </div>
            <Link to={`/transactions?sig=${result.sig}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              View transaction
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---- Fund Account (Transfer SOL) ----

function FundAccountPanel() {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { signer } = useWalletContext()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('0.01')
  const [sending, setSending] = useState(false)
  const [sig, setSig] = useState<string | null>(null)

  const send = useCallback(async () => {
    if (!recipient.trim()) { toast.error('Enter a recipient address'); return }
    if (!signer) { toast.error('Connect a wallet first'); return }

    setSending(true)
    setSig(null)
    try {
      const lamportAmount = lamports(BigInt(Math.floor(parseFloat(amount) * 1_000_000_000)))
      const ix = getTransferSolInstruction({
        source: signer,
        destination: address(recipient.trim()),
        amount: lamportAmount,
      })
      const signature = await buildAndSendTransaction(activeRpcUrl, signer, [ix])
      setSig(signature)
      toast.success('SOL transferred!')
    } catch (e) {
      toast.error('Transfer failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSending(false)
    }
  }, [activeRpcUrl, amount, recipient, signer])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Transfer SOL</CardTitle>
            <CardDescription className="mt-1">Send SOL from your connected wallet to any address.</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-normal shrink-0">Wallet required</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Recipient</Label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Public key…"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount (SOL)</Label>
          <Input
            type="number"
            min="0.000000001"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {!signer && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
            A connected wallet is required as the sender.
          </div>
        )}
        <Button onClick={send} disabled={sending || !signer || !recipient.trim()}>
          {sending && <Loader2 className="size-4 animate-spin mr-2" />}
          Send SOL
        </Button>
        {sig && (
          <Link
            to={`/transactions?sig=${sig}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View transaction
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

// ---- Address book save dialog ----

function AddToAddressBook({ addr }: { addr: string }) {
  const { addEntry } = useAddressBookStore()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const save = () => {
    if (!label.trim()) return
    addEntry({ label: label.trim(), address: addr })
    toast.success('Saved to address book')
    setOpen(false)
    setLabel('')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookMarked className="size-3.5 mr-1.5" /> Save to Book
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to Address Book</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Label</Label><Input placeholder="e.g. My Wallet" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} className="mt-1" /></div>
          <div><Label>Address</Label><Input value={addr} readOnly className="mt-1 font-mono text-xs" /></div>
          <Button onClick={save} disabled={!label.trim()} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Main Page ----

export function AccountsPage() {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { entries, removeEntry } = useAddressBookStore()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [activeTab, setActiveTab] = useState('view')
  const [lookupAddr, setLookupAddr] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [lookedUpAddr, setLookedUpAddr] = useState('')
  const [notFound, setNotFound] = useState(false)

  const handleLookup = useCallback(async (addr?: string) => {
    const target = (addr ?? lookupAddr).trim()
    if (!target) return
    setActiveTab('view')
    setLoading(true)
    setAccountInfo(null)
    setNotFound(false)
    try {
      const info = await fetchAccount(activeRpcUrl, target)
      if (!info) { setNotFound(true) }
      else {
        setAccountInfo(info as unknown as AccountInfo)
        setLookedUpAddr(target)
        if (addr) setLookupAddr(addr)
      }
    } catch (e) {
      toast.error('Lookup failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }, [lookupAddr, activeRpcUrl])

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-muted-foreground text-sm mt-1">Inspect, create, and manage Solana accounts.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="view">View / Inspect</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="fund">Transfer SOL</TabsTrigger>
          <TabsTrigger value="book">Address Book</TabsTrigger>
        </TabsList>

        {/* View Account */}
        <TabsContent value="view" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Inspector</CardTitle>
              <CardDescription>Fetch any account's state by public key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter public key…"
                  value={lookupAddr}
                  onChange={(e) => setLookupAddr(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="font-mono text-sm"
                />
                <Button onClick={() => handleLookup()} disabled={loading || !lookupAddr.trim()}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
                {accountInfo && (
                  <Button variant="ghost" size="icon" onClick={() => handleLookup()} title="Refresh">
                    <RefreshCw className="size-4" />
                  </Button>
                )}
              </div>
              {notFound && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  Account not found on {network}.
                </div>
              )}
              {accountInfo && (
                <div className="space-y-4">
                  <AccountView account={accountInfo} addr={lookedUpAddr} network={network} />
                  <DecodePanel account={accountInfo} addr={lookedUpAddr} />
                  <AddToAddressBook addr={lookedUpAddr} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Account */}
        <TabsContent value="create" className="mt-4">
          <CreateAccountPanel />
        </TabsContent>

        {/* Fund / Transfer */}
        <TabsContent value="fund" className="mt-4">
          <FundAccountPanel />
        </TabsContent>

        {/* Address Book */}
        <TabsContent value="book" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Address Book</CardTitle>
              <CardDescription>Saved addresses for quick access.</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No saved addresses yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{entry.label}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{entry.address}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleLookup(entry.address)}>
                          <Search className="size-3.5 mr-1" />Inspect
                        </Button>
                        <CopyButton text={entry.address} />
                        <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                          onClick={() => removeEntry(entry.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add manually */}
          <AddManualEntry />
        </TabsContent>


      </Tabs>
    </div>
  )
}

function AddManualEntry() {
  const { addEntry } = useAddressBookStore()
  const [label, setLabel] = useState('')
  const [addr, setAddr] = useState('')
  const save = () => {
    if (!label.trim() || !addr.trim()) return
    addEntry({ label: label.trim(), address: addr.trim() })
    toast.success('Saved')
    setLabel(''); setAddr('')
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add Address Manually</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5"><Label>Label</Label><Input placeholder="e.g. Treasury" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Public Key</Label><Input placeholder="Solana address…" value={addr} onChange={(e) => setAddr(e.target.value)} className="font-mono text-sm" /></div>
        <Button onClick={save} disabled={!label.trim() || !addr.trim()}><Plus className="size-4 mr-2" />Add</Button>
      </CardContent>
    </Card>
  )
}
