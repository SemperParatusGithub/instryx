import { useState, useCallback } from 'react'
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
import { fetchAccount, lamportsToSol, formatBytes } from '@/lib/solana/accounts'

type AccountInfo = {
  lamports: bigint
  owner: string
  executable: boolean
  rentEpoch: bigint
  data: [string, string] // [base64, encoding]
  space?: bigint
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

function AccountView({ account, address }: { account: AccountInfo; address: string }) {
  const dataBytes = account.data[0]
    ? Buffer.from(account.data[0], 'base64').length
    : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-0.5">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Lamports</span>
          <div className="flex items-center gap-1">
            <span className="font-mono font-medium">
              {account.lamports.toLocaleString()}
            </span>
            <Badge variant="secondary">{lamportsToSol(account.lamports)} SOL</Badge>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Data Size</span>
          <span className="font-mono font-medium">{formatBytes(dataBytes)}</span>
        </div>

        <div className="space-y-0.5">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Owner</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs truncate">{account.owner}</span>
            <CopyButton text={account.owner} />
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Executable</span>
          <Badge variant={account.executable ? 'default' : 'secondary'}>
            {account.executable ? 'Yes' : 'No'}
          </Badge>
        </div>
      </div>

      {account.data[0] && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Raw Data (base64)</span>
          <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
            {account.data[0]}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Address:</span>
        <span className="font-mono">{address}</span>
        <CopyButton text={address} />
      </div>
    </div>
  )
}

function AddToAddressBook({ address }: { address: string }) {
  const { addEntry } = useAddressBookStore()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')

  const save = () => {
    if (!label.trim()) return
    addEntry({ label: label.trim(), address })
    toast.success('Saved to address book')
    setOpen(false)
    setLabel('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookMarked className="size-3.5 mr-1.5" />
          Save to Address Book
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Address Book</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Label</Label>
            <Input
              placeholder="e.g. My Wallet"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} readOnly className="mt-1 font-mono text-xs" />
          </div>
          <Button onClick={save} disabled={!label.trim()} className="w-full">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AccountsPage() {
  const { rpcUrl, network } = useNetworkStore()
  const { entries, removeEntry } = useAddressBookStore()

  const [lookupAddress, setLookupAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeRpcUrl = network === 'custom'
    ? useNetworkStore.getState().customRpcUrl
    : rpcUrl

  const handleLookup = useCallback(async (addr?: string) => {
    const target = addr ?? lookupAddress
    if (!target.trim()) return
    setLoading(true)
    setAccountInfo(null)
    setNotFound(false)
    try {
      const info = await fetchAccount(activeRpcUrl, target.trim())
      if (!info) {
        setNotFound(true)
      } else {
        setAccountInfo(info as unknown as AccountInfo)
        if (addr) setLookupAddress(addr)
      }
    } catch (e) {
      toast.error('Lookup failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }, [lookupAddress, activeRpcUrl])

  const copyAddress = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inspect, view, and manage Solana accounts.
        </p>
      </div>

      <Tabs defaultValue="view">
        <TabsList>
          <TabsTrigger value="view">View Account</TabsTrigger>
          <TabsTrigger value="book">Address Book</TabsTrigger>
        </TabsList>

        {/* View Account */}
        <TabsContent value="view" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Inspector</CardTitle>
              <CardDescription>
                Look up any account by public key to view its state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter public key…"
                  value={lookupAddress}
                  onChange={(e) => setLookupAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="font-mono text-sm"
                />
                <Button onClick={() => handleLookup()} disabled={loading || !lookupAddress.trim()}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                </Button>
                {accountInfo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleLookup()}
                    title="Refresh"
                  >
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
                <div className="space-y-3">
                  <AccountView account={accountInfo} address={lookupAddress} />
                  <div className="flex gap-2">
                    <AddToAddressBook address={lookupAddress} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Book */}
        <TabsContent value="book" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Address Book</CardTitle>
              <CardDescription>
                Saved addresses for quick access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No saved addresses yet. Look up an account and save it.
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{entry.label}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">
                          {entry.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLookup(entry.address)}
                        >
                          <Search className="size-3.5 mr-1" />
                          Inspect
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => copyAddress(entry.address)}
                        >
                          {copied ? (
                            <CheckCircle2 className="size-3.5 text-green-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => removeEntry(entry.id)}
                        >
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
    toast.success('Saved to address book')
    setLabel('')
    setAddr('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Address Manually</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            placeholder="e.g. Treasury"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Public Key</Label>
          <Input
            placeholder="Solana address…"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <Button onClick={save} disabled={!label.trim() || !addr.trim()}>
          <Plus className="size-4 mr-2" />
          Add to Book
        </Button>
      </CardContent>
    </Card>
  )
}
