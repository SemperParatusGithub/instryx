import { useState, useCallback } from 'react'
import { createSolanaRpc, address, lamports } from '@solana/kit'
import { toast } from 'sonner'
import {
  Wifi,
  WifiOff,
  Loader2,
  Copy,
  Check,
  Droplets,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNetworkStore } from '@/stores/networkStore'
import type { Network } from '@/types'

const NETWORK_LABELS: Record<Network, string> = {
  localnet: 'Localnet',
  devnet: 'Devnet',
  mainnet: 'Mainnet',
  custom: 'Custom RPC',
}

const AIRDROP_NETWORKS: Network[] = ['localnet', 'devnet']

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function NetworkPage() {
  const {
    network,
    rpcUrl,
    customRpcUrl,
    isConnected,
    setNetwork,
    setCustomRpcUrl,
    setIsConnected,
  } = useNetworkStore()

  const [testing, setTesting] = useState(false)
  const [walletAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [airdropAddress, setAirdropAddress] = useState('')
  const [airdropAmount, setAirdropAmount] = useState('1')
  const [airdropping, setAirdropping] = useState(false)
  const [inspectAddress, setInspectAddress] = useState('')
  const [copied, setCopied] = useState(false)

  const activeRpcUrl = network === 'custom' ? customRpcUrl : rpcUrl

  const testConnection = useCallback(async () => {
    if (!activeRpcUrl) return
    setTesting(true)
    setIsConnected(false)
    try {
      const rpc = createSolanaRpc(activeRpcUrl)
      await rpc.getHealth().send()
      setIsConnected(true)
      toast.success('Connected to ' + NETWORK_LABELS[network])
    } catch (e) {
      setIsConnected(false)
      toast.error('Connection failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setTesting(false)
    }
  }, [activeRpcUrl, network, setIsConnected])

  const fetchBalance = useCallback(async (addr: string) => {
    if (!activeRpcUrl || !addr) return
    setLoadingBalance(true)
    try {
      const rpc = createSolanaRpc(activeRpcUrl)
      const result = await rpc.getBalance(address(addr)).send()
      setBalance(result.value)
    } catch (e) {
      toast.error('Failed to fetch balance: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingBalance(false)
    }
  }, [activeRpcUrl])

  const handleAirdrop = useCallback(async () => {
    if (!activeRpcUrl || !airdropAddress) return
    setAirdropping(true)
    try {
      const rpc = createSolanaRpc(activeRpcUrl)
      const lamportAmount = lamports(
        BigInt(Math.floor(parseFloat(airdropAmount) * 1_000_000_000)),
      )
      const sig = await rpc
        .requestAirdrop(address(airdropAddress), lamportAmount)
        .send()
      toast.success(`Airdrop sent! Signature: ${sig.slice(0, 12)}…`)
    } catch (e) {
      toast.error('Airdrop failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAirdropping(false)
    }
  }, [activeRpcUrl, airdropAddress, airdropAmount])

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [])

  const lamportsToSol = (lamports: bigint) =>
    (Number(lamports) / 1_000_000_000).toFixed(6)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Network & Wallet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your RPC endpoint and inspect accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left column — RPC config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RPC Configuration</CardTitle>
            <CardDescription>Select a network or provide a custom RPC URL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Network</Label>
              <Select value={network} onValueChange={(v) => setNetwork(v as Network)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="localnet">Localnet (http://127.0.0.1:8899)</SelectItem>
                  <SelectItem value="devnet">Devnet</SelectItem>
                  <SelectItem value="mainnet">Mainnet Beta</SelectItem>
                  <SelectItem value="custom">Custom RPC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {network === 'custom' && (
              <div className="space-y-1.5">
                <Label>Custom RPC URL</Label>
                <Input
                  placeholder="https://my-rpc.example.com"
                  value={customRpcUrl}
                  onChange={(e) => setCustomRpcUrl(e.target.value)}
                />
              </div>
            )}

            {network !== 'custom' && (
              <div className="space-y-1.5">
                <Label>RPC URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={rpcUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copy(rpcUrl)}
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={testConnection} disabled={testing || !activeRpcUrl}>
                {testing ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="size-4 mr-2" />
                )}
                Test Connection
              </Button>
              <div className="flex items-center gap-1.5 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="size-4 text-green-500" />
                    <span className="text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column — balance + airdrop */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Balance</CardTitle>
              <CardDescription>Look up the SOL balance of any address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a public key…"
                  value={inspectAddress}
                  onChange={(e) => setInspectAddress(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => fetchBalance(inspectAddress)}
                  disabled={loadingBalance || !inspectAddress}
                >
                  {loadingBalance ? <Loader2 className="size-4 animate-spin" /> : 'Fetch'}
                </Button>
              </div>

              {balance !== null && walletAddress === null && (
                <div className="rounded-md bg-muted p-3 flex items-center justify-between">
                  <span className="text-sm font-mono text-muted-foreground truncate mr-4">
                    {truncate(inspectAddress)}
                  </span>
                  <Badge variant="secondary" className="font-mono shrink-0">
                    {lamportsToSol(balance)} SOL
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {AIRDROP_NETWORKS.includes(network) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Droplets className="size-4 text-blue-400" />
                  Airdrop SOL
                </CardTitle>
                <CardDescription>
                  Request test SOL on {NETWORK_LABELS[network]}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Recipient Address</Label>
                  <Input
                    placeholder="Public key…"
                    value={airdropAddress}
                    onChange={(e) => setAirdropAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (SOL)</Label>
                  <Input
                    type="number"
                    min="0.001"
                    max="10"
                    step="0.5"
                    value={airdropAmount}
                    onChange={(e) => setAirdropAmount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAirdrop}
                  disabled={airdropping || !airdropAddress}
                >
                  {airdropping && <Loader2 className="size-4 animate-spin mr-2" />}
                  Request Airdrop
                </Button>
              </CardContent>
            </Card>
          )}

          {walletAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Connected Wallet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{walletAddress}</span>
                  <Button variant="ghost" size="icon" onClick={() => copy(walletAddress)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
