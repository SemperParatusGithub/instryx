import { useState, useCallback, useEffect } from 'react'
import { createSolanaRpc, address, generateKeyPairSigner, lamports } from '@solana/kit'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { buildAndSendTransaction } from '@/lib/solana/sendTransaction'

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

function CreateAccountPanel() {
  const { rpcUrl, network, customRpcUrl } = useNetworkStore()
  const { signer, isConnected } = useWalletContext()
  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const [ownerProgram, setOwnerProgram] = useState('11111111111111111111111111111111')
  const [spaceBytes, setSpaceBytes] = useState('0')
  const [customLamports, setCustomLamports] = useState('')
  const [rentExempt, setRentExempt] = useState<bigint | null>(null)
  const [loadingRent, setLoadingRent] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createdAddress, setCreatedAddress] = useState<string | null>(null)
  const [sig, setSig] = useState<string | null>(null)

  // New account keypair — generated client-side, no wallet required
  const [newAcctSigner, setNewAcctSigner] = useState<Awaited<ReturnType<typeof generateKeyPairSigner>> | null>(null)
  const [generatingKeypair, setGeneratingKeypair] = useState(false)

  const generateKeypair = useCallback(async () => {
    setGeneratingKeypair(true)
    try {
      const kp = await generateKeyPairSigner()
      setNewAcctSigner(kp)
    } finally {
      setGeneratingKeypair(false)
    }
  }, [])

  // Auto-generate a new account address on mount
  useEffect(() => { generateKeypair() }, [generateKeypair])

  const fetchRent = useCallback(async () => {
    setLoadingRent(true)
    try {
      const rpc = createSolanaRpc(activeRpcUrl)
      const result = await rpc.getMinimumBalanceForRentExemption(BigInt(spaceBytes)).send()
      setRentExempt(result)
    } catch (e) {
      toast.error('Failed to fetch rent: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingRent(false)
    }
  }, [activeRpcUrl, spaceBytes])

  useEffect(() => { fetchRent() }, [fetchRent])

  const create = useCallback(async () => {
    if (!signer) { toast.error('Connect a wallet first'); return }
    if (!newAcctSigner) { toast.error('Generate a keypair first'); return }

    setCreating(true)
    setCreatedAddress(null)
    setSig(null)
    try {
      const lamportAmount = customLamports
        ? lamports(BigInt(customLamports))
        : lamports(rentExempt ?? 0n)

      const ix = getCreateAccountInstruction({
        payer: signer,
        newAccount: newAcctSigner,
        lamports: lamportAmount,
        space: BigInt(spaceBytes),
        programAddress: address(ownerProgram),
      })

      const signature = await buildAndSendTransaction(activeRpcUrl, signer, [ix])
      setCreatedAddress(newAcctSigner.address)
      setSig(signature)
      toast.success('Account created!')
    } catch (e) {
      toast.error('Create failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setCreating(false)
    }
  }, [activeRpcUrl, customLamports, isConnected, newAcctSigner, ownerProgram, rentExempt, signer, spaceBytes])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Account</CardTitle>
        <CardDescription>
          Allocate a new on-chain account via the System Program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Step 1 — client-side, no wallet needed */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>New Account Address</Label>
            <Badge variant="secondary" className="text-xs font-normal">No wallet required</Badge>
          </div>
          <div className="flex gap-2">
            <Input
              readOnly
              value={newAcctSigner?.address ?? ''}
              placeholder="Generating…"
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={generateKeypair}
              disabled={generatingKeypair}
              title="Generate a new keypair"
            >
              {generatingKeypair
                ? <Loader2 className="size-4 animate-spin" />
                : <RefreshCw className="size-4" />}
            </Button>
            {newAcctSigner && <CopyButton text={newAcctSigner.address} />}
          </div>
          <p className="text-xs text-muted-foreground">
            A new Ed25519 keypair is generated locally in your browser. Click <RefreshCw className="size-3 inline" /> to regenerate.
          </p>
        </div>

        {/* Step 2 — account parameters */}
        <div className="space-y-1.5">
          <Label>Owner Program</Label>
          <Input
            value={ownerProgram}
            onChange={(e) => setOwnerProgram(e.target.value)}
            placeholder="Program ID that will own this account"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Space (bytes)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              value={spaceBytes}
              onChange={(e) => setSpaceBytes(e.target.value)}
            />
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
          <Label>Lamports (leave blank for rent-exempt minimum)</Label>
          <Input
            type="number"
            placeholder={rentExempt !== null ? rentExempt.toString() : 'auto'}
            value={customLamports}
            onChange={(e) => setCustomLamports(e.target.value)}
          />
        </div>

        {/* Step 3 — on-chain creation, wallet required */}
        <div className="space-y-2">
          {!signer && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
              A connected wallet is required to pay the rent-exempt deposit
              {rentExempt !== null ? ` (${lamportsToSol(rentExempt)} SOL)` : ''}.
            </div>
          )}
          <Button onClick={create} disabled={creating || !signer || !newAcctSigner}>
            {creating && <Loader2 className="size-4 animate-spin mr-2" />}
            Create Account
          </Button>
        </div>

        {createdAddress && sig && (
          <div className="rounded-md bg-muted p-3 space-y-1 text-xs">
            <p className="text-green-500 font-medium">Account created!</p>
            <p className="text-muted-foreground">Address: <span className="font-mono">{createdAddress}</span></p>
            <a
              href={`https://explorer.solana.com/tx/${sig}${network === 'devnet' ? '?cluster=devnet' : ''}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-3" /> View transaction
            </a>
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
          <a
            href={`https://explorer.solana.com/tx/${sig}${network === 'devnet' ? '?cluster=devnet' : ''}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" /> View transaction
          </a>
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

  const [lookupAddr, setLookupAddr] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [lookedUpAddr, setLookedUpAddr] = useState('')
  const [notFound, setNotFound] = useState(false)

  const handleLookup = useCallback(async (addr?: string) => {
    const target = (addr ?? lookupAddr).trim()
    if (!target) return
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

      <Tabs defaultValue="view">
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
