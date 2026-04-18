import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createSolanaRpc, address } from '@solana/kit'
import { toast } from 'sonner'
import { Search, Loader2, Copy, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import bs58 from 'bs58'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useNetworkStore } from '@/stores/networkStore'

// ---- Types ------------------------------------------------------------------

type MessageHeader = {
  numRequiredSignatures: number
  numReadonlySignedAccounts: number
  numReadonlyUnsignedAccounts: number
}

type RawInstruction = {
  programIdIndex: number
  accounts: readonly number[]
  data: string // base58
  stackHeight?: number | null
}

type InnerInstructionSet = {
  index: number
  instructions: RawInstruction[]
}

type TokenBalance = {
  accountIndex: number
  mint: string
  owner?: string
  programId?: string
  uiTokenAmount: {
    amount: string
    decimals: number
    uiAmountString: string
  }
}

type TransactionMeta = {
  err: unknown
  fee: bigint
  computeUnitsConsumed?: bigint | null
  logMessages?: readonly string[] | null
  preBalances: readonly bigint[]
  postBalances: readonly bigint[]
  innerInstructions?: InnerInstructionSet[] | null
  preTokenBalances?: TokenBalance[] | null
  postTokenBalances?: TokenBalance[] | null
  loadedAddresses?: { writable: readonly string[]; readonly: readonly string[] } | null
  rewards?: unknown[] | null
}

type TransactionMessage = {
  header?: MessageHeader
  accountKeys?: Array<string | { pubkey: string }>
  staticAccountKeys?: readonly string[]
  instructions: RawInstruction[]
  recentBlockhash?: string
  addressTableLookups?: Array<{
    accountKey: string
    writableIndexes: readonly number[]
    readonlyIndexes: readonly number[]
  }>
}

type TransactionDetail = {
  slot: bigint
  blockTime?: number | bigint | null
  version?: string | number | null
  meta: TransactionMeta | null
  transaction: {
    signatures: string[]
    message: TransactionMessage
  }
}

type RecentTx = {
  signature: string
  slot: bigint
  err: unknown
  blockTime?: number | bigint | null
  confirmationStatus?: string | null
}

// ---- Helpers ----------------------------------------------------------------

function lamportsToSol(l: bigint) {
  return (Number(l) / 1_000_000_000).toFixed(9).replace(/\.?0+$/, '') || '0'
}

function lamportsDiff(diff: bigint) {
  const sol = (Number(diff) / 1_000_000_000).toFixed(9).replace(/\.?0+$/, '') || '0'
  return `${diff > 0n ? '+' : ''}${sol}`
}

/** Normalise message.accountKeys to a plain string[] regardless of transaction version. */
function resolveAccountKeys(msg: TransactionMessage, loadedAddresses?: TransactionMeta['loadedAddresses']): string[] {
  let keys: string[] = []
  if (msg.staticAccountKeys) {
    keys = [...msg.staticAccountKeys] as string[]
  } else if (msg.accountKeys) {
    keys = msg.accountKeys.map((k) => (typeof k === 'string' ? k : k.pubkey))
  }
  if (loadedAddresses) {
    keys = [...keys, ...(loadedAddresses.writable ?? []), ...(loadedAddresses.readonly ?? [])]
  }
  return keys
}

/** Determine per-account roles from message header. */
type AccountRole = { signer: boolean; writable: boolean; feePayer: boolean }
function getAccountRoles(keys: string[], header?: MessageHeader): AccountRole[] {
  if (!header) return keys.map((_, i) => ({ signer: false, writable: false, feePayer: i === 0 }))
  const { numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts } = header
  return keys.map((_, i) => {
    const isSigner   = i < numRequiredSignatures
    const isWritable = isSigner
      ? i < numRequiredSignatures - numReadonlySignedAccounts
      : i < keys.length - numReadonlyUnsignedAccounts
    return { signer: isSigner, writable: isWritable, feePayer: i === 0 }
  })
}

/** Decode base58 instruction data to a hex string. */
function dataToHex(base58Data: string): string {
  try {
    const bytes = bs58.decode(base58Data)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ')
  } catch {
    return base58Data
  }
}

function truncate(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-8)}`
}

// ---- Sub-components ---------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-6 ${className ?? ''}`}
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
    >
      {copied ? <CheckCircle2 className="size-3 text-green-500" /> : <Copy className="size-3" />}
    </Button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{children}</p>
}

/** A single instruction row — expandable to show accounts + data. */
function InstructionRow({
  ix,
  index,
  accountKeys,
  innerSets,
  label,
}: {
  ix: RawInstruction
  index: number
  accountKeys: string[]
  innerSets: InnerInstructionSet[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const programAddr = accountKeys[ix.programIdIndex] ?? `#${ix.programIdIndex}`
  const innerSet = innerSets.find((s) => s.index === index)

  return (
    <div className="rounded-md border bg-muted/20">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-md"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="size-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground w-6 shrink-0">{label ?? `#${index}`}</span>
        <span className="font-mono text-xs truncate flex-1">{truncate(programAddr)}</span>
        <div className="flex gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px] py-0 px-1">{ix.accounts.length} accts</Badge>
          {ix.data && ix.data !== '1' /* empty data */ && <Badge variant="outline" className="text-[10px] py-0 px-1">data</Badge>}
          {innerSet && <Badge variant="secondary" className="text-[10px] py-0 px-1">{innerSet.instructions.length} CPI</Badge>}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-2 border-t space-y-3 text-xs">
          {/* Program */}
          <div>
            <SectionLabel>Program</SectionLabel>
            <div className="flex items-center gap-1 font-mono bg-muted rounded px-2 py-1">
              <span className="flex-1">{programAddr}</span>
              <CopyButton text={programAddr} />
            </div>
          </div>

          {/* Accounts */}
          {ix.accounts.length > 0 && (
            <div>
              <SectionLabel>Accounts ({ix.accounts.length})</SectionLabel>
              <div className="rounded border divide-y">
                {ix.accounts.map((idx, pos) => {
                  const addr = accountKeys[idx] ?? `#${idx}`
                  return (
                    <div key={pos} className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-muted-foreground w-4 shrink-0">{pos}</span>
                      <span className="font-mono flex-1 truncate">{addr}</span>
                      <CopyButton text={addr} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Data */}
          {ix.data && ix.data !== '1' && (
            <div>
              <SectionLabel>Data (hex)</SectionLabel>
              <pre className="font-mono bg-muted rounded px-2 py-1.5 break-all whitespace-pre-wrap leading-5">
                {dataToHex(ix.data)}
              </pre>
            </div>
          )}

          {/* Inner instructions (CPI) */}
          {innerSet && innerSet.instructions.length > 0 && (
            <div>
              <SectionLabel>Inner Instructions (CPI)</SectionLabel>
              <div className="space-y-1.5 pl-3 border-l-2 border-muted">
                {innerSet.instructions.map((inner, j) => (
                  <InstructionRow
                    key={j}
                    ix={inner}
                    index={j}
                    accountKeys={accountKeys}
                    innerSets={[]}
                    label={`${index}.${j}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Color-coded program log line. */
function LogLine({ line }: { line: string }) {
  const isInvoke  = line.startsWith('Program') && line.includes('invoke')
  const isSuccess = line.includes('success')
  const isFail    = line.includes('failed') || line.includes('Error')
  const isLog     = line.startsWith('Program log:')
  const isData    = line.startsWith('Program data:')
  const isReturn  = line.startsWith('Program return:')

  const color = isFail    ? 'text-destructive'
              : isSuccess ? 'text-green-500'
              : isLog     ? 'text-foreground'
              : isData || isReturn ? 'text-blue-400'
              : isInvoke  ? 'text-yellow-500'
              : 'text-muted-foreground'

  return <span className={`block ${color}`}>{line}</span>
}

// ---- TxDetail ---------------------------------------------------------------

function TxDetail({ detail, sig }: { detail: TransactionDetail; sig: string }) {
  const { meta, transaction } = detail
  const msg = transaction.message
  const accountKeys = resolveAccountKeys(msg, meta?.loadedAddresses ?? undefined)
  const roles = getAccountRoles(accountKeys, msg.header)
  const innerSets: InnerInstructionSet[] = (meta?.innerInstructions as InnerInstructionSet[] | null | undefined) ?? []
  const blockTime = detail.blockTime
    ? new Date(Number(detail.blockTime) * 1000).toLocaleString()
    : '—'

  const signerCount   = roles.filter((r) => r.signer).length
  const writableCount = roles.filter((r) => r.writable).length
  const hasTokenBalances = (meta?.preTokenBalances?.length ?? 0) > 0 || (meta?.postTokenBalances?.length ?? 0) > 0

  // Build token balance diff map keyed by accountIndex
  const tokenDiffs = new Map<number, { mint: string; owner?: string; pre?: TokenBalance; post?: TokenBalance }>()
  for (const tb of meta?.preTokenBalances ?? []) {
    tokenDiffs.set(tb.accountIndex, { mint: tb.mint, owner: tb.owner, pre: tb })
  }
  for (const tb of meta?.postTokenBalances ?? []) {
    const existing = tokenDiffs.get(tb.accountIndex)
    if (existing) existing.post = tb
    else tokenDiffs.set(tb.accountIndex, { mint: tb.mint, owner: tb.owner, post: tb })
  }

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="accounts">Accounts ({accountKeys.length})</TabsTrigger>
        <TabsTrigger value="instructions">Instructions ({msg.instructions.length})</TabsTrigger>
        {(meta?.logMessages?.length ?? 0) > 0 && (
          <TabsTrigger value="logs">Logs</TabsTrigger>
        )}
        <TabsTrigger value="balances">Balances</TabsTrigger>
      </TabsList>

      {/* ── Overview ── */}
      <TabsContent value="overview" className="space-y-4 mt-0">
        {/* Signature */}
        <div>
          <SectionLabel>Signature</SectionLabel>
          <div className="flex items-center gap-1 font-mono text-xs bg-muted rounded px-2 py-1.5 break-all">
            <span className="flex-1">{sig}</span>
            <CopyButton text={sig} />
          </div>
        </div>

        {/* Grid of key facts */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
            {meta?.err ? (
              <div className="space-y-0.5">
                <Badge variant="destructive">Failed</Badge>
                <p className="text-xs font-mono text-destructive break-all">{JSON.stringify(meta.err)}</p>
              </div>
            ) : (
              <Badge variant="secondary">Success</Badge>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Slot</p>
            <p className="font-mono">{detail.slot.toString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Timestamp</p>
            <p className="text-sm">{blockTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Version</p>
            <p className="font-mono">{detail.version != null ? String(detail.version) : 'legacy'}</p>
          </div>
          {meta?.fee !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Fee</p>
              <p className="font-mono">{lamportsToSol(meta.fee)} SOL</p>
            </div>
          )}
          {meta?.computeUnitsConsumed != null && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Compute Units</p>
              <p className="font-mono">{meta.computeUnitsConsumed.toLocaleString()}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Instructions</p>
            <p className="font-mono">{msg.instructions.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Signers / Accounts</p>
            <p className="font-mono">{signerCount} / {accountKeys.length}</p>
          </div>
        </div>

        {/* Recent blockhash */}
        {msg.recentBlockhash && (
          <div>
            <SectionLabel>Recent Blockhash</SectionLabel>
            <div className="flex items-center gap-1 font-mono text-xs bg-muted rounded px-2 py-1.5">
              <span className="flex-1 truncate">{msg.recentBlockhash}</span>
              <CopyButton text={msg.recentBlockhash} />
            </div>
          </div>
        )}

        {/* All signatures */}
        {transaction.signatures.length > 1 && (
          <div>
            <SectionLabel>All Signatures ({transaction.signatures.length})</SectionLabel>
            <div className="space-y-1">
              {transaction.signatures.map((s, i) => (
                <div key={i} className="flex items-center gap-1 font-mono text-xs bg-muted rounded px-2 py-1">
                  <span className="text-muted-foreground w-4 shrink-0">{i}</span>
                  <span className="flex-1 truncate">{s}</span>
                  <CopyButton text={s} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Address table lookups */}
        {msg.addressTableLookups && msg.addressTableLookups.length > 0 && (
          <div>
            <SectionLabel>Address Lookup Tables ({msg.addressTableLookups.length})</SectionLabel>
            <div className="space-y-1">
              {msg.addressTableLookups.map((lut, i) => (
                <div key={i} className="rounded border px-3 py-2 text-xs space-y-0.5">
                  <div className="flex items-center gap-1 font-mono">
                    <span className="flex-1 truncate">{lut.accountKey}</span>
                    <CopyButton text={lut.accountKey} />
                  </div>
                  <p className="text-muted-foreground">
                    Writable: [{lut.writableIndexes.join(', ')}] &nbsp; Readonly: [{lut.readonlyIndexes.join(', ')}]
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Accounts ── */}
      <TabsContent value="accounts" className="mt-0">
        <div className="text-xs text-muted-foreground mb-2">
          {writableCount} writable · {signerCount} signer
        </div>
        <div className="rounded border divide-y">
          {accountKeys.map((addr, i) => {
            const role = roles[i]
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="text-muted-foreground w-5 shrink-0 text-right">{i}</span>
                <span className="font-mono flex-1 truncate">{addr}</span>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {role?.feePayer  && <Badge variant="secondary"   className="text-[10px] py-0 px-1">fee payer</Badge>}
                  {role?.signer    && <Badge variant="secondary"   className="text-[10px] py-0 px-1">signer</Badge>}
                  {role?.writable  && <Badge variant="outline"     className="text-[10px] py-0 px-1">writable</Badge>}
                </div>
                <CopyButton text={addr} />
              </div>
            )
          })}
        </div>
      </TabsContent>

      {/* ── Instructions ── */}
      <TabsContent value="instructions" className="mt-0 space-y-2">
        {msg.instructions.map((ix, i) => (
          <InstructionRow
            key={i}
            ix={ix}
            index={i}
            accountKeys={accountKeys}
            innerSets={innerSets}
          />
        ))}
      </TabsContent>

      {/* ── Logs ── */}
      {(meta?.logMessages?.length ?? 0) > 0 && (
        <TabsContent value="logs" className="mt-0">
          <pre className="text-xs font-mono bg-muted rounded p-3 max-h-96 overflow-y-auto leading-5">
            {meta!.logMessages!.map((line, i) => <LogLine key={i} line={line} />)}
          </pre>
        </TabsContent>
      )}

      {/* ── Balances ── */}
      <TabsContent value="balances" className="mt-0 space-y-4">
        {/* SOL */}
        <div>
          <SectionLabel>SOL Balance Changes</SectionLabel>
          {meta && meta.preBalances.length > 0 ? (() => {
            const changed = meta.preBalances
              .map((pre, i) => ({ i, pre, post: meta.postBalances[i], diff: meta.postBalances[i] - pre }))
              .filter((r) => r.diff !== 0n)
            return changed.length > 0 ? (
              <div className="rounded border divide-y">
                {changed.map(({ i, pre, post, diff }) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-2 px-3 py-2 text-xs">
                    <span className="text-muted-foreground text-right">{i}</span>
                    <span className="font-mono truncate">{accountKeys[i] ? truncate(accountKeys[i]) : `#${i}`}</span>
                    <span className="font-mono text-muted-foreground">{lamportsToSol(pre)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`font-mono font-medium ${diff > 0n ? 'text-green-500' : 'text-destructive'}`}>
                      {lamportsDiff(diff)} SOL
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">No SOL balance changes.</p>
          })() : <p className="text-xs text-muted-foreground">No balance data.</p>}
        </div>

        {/* Tokens */}
        {hasTokenBalances && (
          <div>
            <SectionLabel>Token Balance Changes</SectionLabel>
            <div className="rounded border divide-y">
              {[...tokenDiffs.entries()].map(([accountIndex, { mint, owner, pre, post }]) => {
                const preAmt  = BigInt(pre?.uiTokenAmount.amount  ?? '0')
                const postAmt = BigInt(post?.uiTokenAmount.amount ?? '0')
                const diff = postAmt - preAmt
                const decimals = pre?.uiTokenAmount.decimals ?? post?.uiTokenAmount.decimals ?? 0
                const fmt = (n: bigint) => (Number(n) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: decimals })
                return (
                  <div key={accountIndex} className="px-3 py-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-right shrink-0">{accountIndex}</span>
                      <span className="font-mono truncate flex-1">{accountKeys[accountIndex] ? truncate(accountKeys[accountIndex]) : `#${accountIndex}`}</span>
                      <span className={`font-mono font-medium shrink-0 ${diff > 0n ? 'text-green-500' : diff < 0n ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {diff >= 0n ? '+' : ''}{fmt(diff)}
                      </span>
                    </div>
                    <div className="flex gap-2 pl-7 text-muted-foreground">
                      <span>Mint: <span className="font-mono">{truncate(mint)}</span></span>
                      {owner && <span>Owner: <span className="font-mono">{truncate(owner)}</span></span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

// ---- TxRow ------------------------------------------------------------------

function TxRow({ tx, onSelect }: { tx: RecentTx; onSelect: (sig: string) => void }) {
  const time = tx.blockTime ? new Date(Number(tx.blockTime) * 1000).toLocaleTimeString() : '—'
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-muted text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant={tx.err ? 'destructive' : 'secondary'} className="text-xs shrink-0">
          {tx.err ? 'Fail' : 'OK'}
        </Badge>
        <span className="font-mono text-xs truncate text-muted-foreground">{tx.signature.slice(0, 24)}…</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">{time}</span>
        <CopyButton text={tx.signature} />
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onSelect(tx.signature)}>Details</Button>
      </div>
    </div>
  )
}

// ---- Page -------------------------------------------------------------------

export function TransactionsPage() {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl
  const [searchParams] = useSearchParams()

  const [accountAddress, setAccountAddress] = useState('')
  const [sigLookup, setSigLookup]   = useState(() => searchParams.get('sig') ?? '')
  const [activeTab, setActiveTab]   = useState<string>(() => searchParams.get('sig') ? 'sig' : 'account')
  const [loading, setLoading]       = useState(false)
  const [recentTxs, setRecentTxs]   = useState<RecentTx[]>([])
  const [selectedDetail, setSelectedDetail] = useState<{ sig: string; detail: TransactionDetail } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchRecent = useCallback(async () => {
    if (!accountAddress.trim()) return
    setLoading(true)
    setRecentTxs([])
    setSelectedDetail(null)
    try {
      const rpc  = createSolanaRpc(activeRpcUrl)
      const sigs = await rpc.getSignaturesForAddress(address(accountAddress.trim()), { limit: 25 }).send()
      setRecentTxs(sigs as unknown as RecentTx[])
    } catch (e) {
      toast.error('Failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }, [accountAddress, activeRpcUrl])

  const fetchDetail = useCallback(async (sig: string) => {
    setDetailLoading(true)
    setSelectedDetail(null)
    try {
      const rpc    = createSolanaRpc(activeRpcUrl)
      const detail = await rpc.getTransaction(
        sig as Parameters<typeof rpc.getTransaction>[0],
        { encoding: 'json', maxSupportedTransactionVersion: 0 },
      ).send()
      if (detail) {
        setSelectedDetail({ sig, detail: detail as unknown as TransactionDetail })
      } else {
        toast.error('Transaction not found')
      }
    } catch (e) {
      toast.error('Failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setDetailLoading(false)
    }
  }, [activeRpcUrl])

  const lookupBySig = useCallback(async () => {
    if (!sigLookup.trim()) return
    await fetchDetail(sigLookup.trim())
  }, [sigLookup, fetchDetail])

  useEffect(() => {
    const sig = searchParams.get('sig')
    if (sig) {
      setSigLookup(sig)
      setActiveTab('sig')
      fetchDetail(sig)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transaction Inspector</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse and inspect Solana transactions in detail.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="account">By Account</TabsTrigger>
          <TabsTrigger value="sig">By Signature</TabsTrigger>
        </TabsList>

        {/* By account */}
        <TabsContent value="account" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <CardDescription>Fetch the 25 most recent transactions for an address or program.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Account or program public key…"
                  value={accountAddress}
                  onChange={(e) => setAccountAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRecent()}
                  className="font-mono text-sm"
                />
                <Button onClick={fetchRecent} disabled={loading || !accountAddress.trim()}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>

              {recentTxs.length > 0 && (
                <div>
                  <Separator className="mb-2" />
                  {recentTxs.map((tx) => (
                    <TxRow key={tx.signature} tx={tx} onSelect={fetchDetail} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(detailLoading || selectedDetail) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transaction Detail</CardTitle>
              </CardHeader>
              <CardContent>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : selectedDetail ? (
                  <TxDetail detail={selectedDetail.detail} sig={selectedDetail.sig} />
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* By signature */}
        <TabsContent value="sig" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lookup by Signature</CardTitle>
              <CardDescription>Enter a transaction signature to inspect it directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Transaction Signature</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Transaction signature (base58)…"
                    value={sigLookup}
                    onChange={(e) => setSigLookup(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookupBySig()}
                    className="font-mono text-sm"
                  />
                  <Button onClick={lookupBySig} disabled={detailLoading || !sigLookup.trim()}>
                    {detailLoading ? <Loader2 className="size-4 animate-spin" /> : 'Fetch'}
                  </Button>
                </div>
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              )}

              {selectedDetail && !detailLoading && (
                <TxDetail detail={selectedDetail.detail} sig={selectedDetail.sig} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
