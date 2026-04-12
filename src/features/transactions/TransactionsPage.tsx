import { useState, useCallback } from 'react'
import { createSolanaRpc, address } from '@solana/kit'
import { toast } from 'sonner'
import { Search, Loader2, Copy, CheckCircle2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useNetworkStore } from '@/stores/networkStore'
import { useIdlStore } from '@/stores/idlStore'

type TransactionMeta = {
  err: unknown
  fee: bigint
  computeUnitsConsumed?: bigint | null
  logMessages?: readonly string[] | null
  preBalances: readonly bigint[]
  postBalances: readonly bigint[]
}

type TransactionDetail = {
  slot: bigint
  blockTime?: number | bigint | null
  meta: TransactionMeta | null
  transaction: {
    message: {
      accountKeys?: Array<{ pubkey: string }>
      staticAccountKeys?: readonly string[]
      instructions: Array<{
        programIdIndex: number
        accounts: readonly number[]
        data: string
      }>
    }
  }
}

type RecentTx = {
  signature: string
  slot: bigint
  err: unknown
  blockTime?: number | bigint | null
  confirmationStatus?: string | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? (
        <CheckCircle2 className="size-3 text-green-500" />
      ) : (
        <Copy className="size-3" />
      )}
    </Button>
  )
}

function explorerUrl(sig: string, network: string) {
  const cluster =
    network === 'mainnet'
      ? ''
      : network === 'devnet'
        ? '?cluster=devnet'
        : network === 'localnet'
          ? '?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899'
          : '?cluster=devnet'
  return `https://explorer.solana.com/tx/${sig}${cluster}`
}

function TxRow({
  tx,
  onSelect,
  network,
}: {
  tx: RecentTx
  onSelect: (sig: string) => void
  network: string
}) {
  const time = tx.blockTime
    ? new Date(Number(tx.blockTime) * 1000).toLocaleTimeString()
    : '—'

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-muted group text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Badge
          variant={tx.err ? 'destructive' : 'secondary'}
          className="text-xs shrink-0"
        >
          {tx.err ? 'Fail' : 'OK'}
        </Badge>
        <span className="font-mono text-xs truncate text-muted-foreground">
          {tx.signature.slice(0, 20)}…
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">{time}</span>
        <CopyButton text={tx.signature} />
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onSelect(tx.signature)}>
          Details
        </Button>
        <a
          href={explorerUrl(tx.signature, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

function TxDetail({ detail, sig, network }: { detail: TransactionDetail; sig: string; network: string }) {
  const { meta } = detail
  const lamportsToSol = (l: bigint) => (Number(l) / 1_000_000_000).toFixed(6)
  const blockTime = detail.blockTime
    ? new Date(Number(detail.blockTime) * 1000).toLocaleString()
    : '—'

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Slot</p>
          <p className="font-mono">{detail.slot.toString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Time</p>
          <p>{blockTime}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
          <Badge variant={meta?.err ? 'destructive' : 'secondary'}>
            {meta?.err ? 'Failed' : 'Success'}
          </Badge>
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
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-muted-foreground truncate">{sig}</span>
        <CopyButton text={sig} />
        <a
          href={explorerUrl(sig, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" /> Explorer
        </a>
      </div>

      {/* Balance changes */}
      {meta && meta.preBalances.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Balance Changes
          </p>
          <div className="space-y-0.5">
            {meta.preBalances.map((pre, i) => {
              const post = meta.postBalances[i]
              const diff = post - pre
              if (diff === 0n) return null
              return (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs font-mono px-2 py-1 rounded bg-muted"
                >
                  <span className="text-muted-foreground">Account {i}</span>
                  <span className={diff > 0n ? 'text-green-500' : 'text-destructive'}>
                    {diff > 0n ? '+' : ''}{lamportsToSol(diff)} SOL
                  </span>
                </div>
              )
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Logs */}
      {meta?.logMessages && meta.logMessages.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Program Logs
          </p>
          <pre className="text-xs font-mono bg-muted p-2 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
            {meta.logMessages.join('\n')}
          </pre>
        </div>
      )}
    </div>
  )
}

export function TransactionsPage() {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  useIdlStore() // available for future IDL-based instruction decoding
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [accountAddress, setAccountAddress] = useState('')
  const [sigLookup, setSigLookup] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([])
  const [selectedDetail, setSelectedDetail] = useState<{ sig: string; detail: TransactionDetail } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchRecent = useCallback(async () => {
    if (!accountAddress.trim()) return
    setLoading(true)
    setRecentTxs([])
    setSelectedDetail(null)
    try {
      const rpc = createSolanaRpc(activeRpcUrl)
      const sigs = await rpc
        .getSignaturesForAddress(address(accountAddress.trim()), { limit: 25 })
        .send()
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
      const rpc = createSolanaRpc(activeRpcUrl)
      const detail = await rpc
        .getTransaction(sig as Parameters<typeof rpc.getTransaction>[0], {
          encoding: 'json',
          maxSupportedTransactionVersion: 0,
        })
        .send()
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

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transaction Inspector</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse recent transactions and inspect their details.
        </p>
      </div>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">By Account</TabsTrigger>
          <TabsTrigger value="sig">By Signature</TabsTrigger>
        </TabsList>

        {/* By account */}
        <TabsContent value="account" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <CardDescription>
                Fetch the 25 most recent transactions for an address or program.
              </CardDescription>
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
                    <TxRow
                      key={tx.signature}
                      tx={tx}
                      onSelect={fetchDetail}
                      network={network}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail panel */}
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
                  <TxDetail
                    detail={selectedDetail.detail}
                    sig={selectedDetail.sig}
                    network={network}
                  />
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
              <CardDescription>
                Enter a transaction signature to inspect it directly.
              </CardDescription>
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

              {selectedDetail && (
                <TxDetail
                  detail={selectedDetail.detail}
                  sig={selectedDetail.sig}
                  network={network}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
