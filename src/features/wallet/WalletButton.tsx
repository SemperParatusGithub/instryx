import { useState } from 'react'
import { Wallet, ChevronDown, LogOut, Copy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useWalletContext } from './useWalletContext'

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function WalletButton() {
  const { isConnected, walletAddress, wallets, setAccount } = useWalletContext()
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (isConnected && walletAddress) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-green-500 shrink-0" />
              {truncate(walletAddress)}
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <div className="px-2 py-1.5 text-xs text-muted-foreground font-mono break-all">
            {walletAddress}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copy}>
            {copied ? (
              <CheckCircle2 className="size-3.5 mr-2 text-green-500" />
            ) : (
              <Copy className="size-3.5 mr-2" />
            )}
            Copy address
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setAccount(undefined)}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="size-3.5 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Not connected — show available wallets
  if (wallets.length === 0) {
    return (
      <Button variant="outline" size="sm" className="w-full text-xs" disabled>
        <Wallet className="size-3.5 mr-1.5" />
        No wallet found
      </Button>
    )
  }

  if (wallets.length === 1) {
    const wallet = wallets[0]
    const firstAccount = wallet.accounts[0]
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => firstAccount && setAccount(firstAccount)}
        disabled={!firstAccount}
      >
        <Wallet className="size-3.5 mr-1.5" />
        Connect {wallet.name}
      </Button>
    )
  }

  // Multiple wallets
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Wallet className="size-3.5" />
            Connect Wallet
          </div>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {wallets.map((wallet) =>
          wallet.accounts.map((acc) => (
            <DropdownMenuItem
              key={`${wallet.name}-${acc.address}`}
              onClick={() => setAccount(acc)}
            >
              <span className="truncate">{wallet.name}</span>
              <Badge variant="secondary" className="ml-auto text-xs font-mono">
                {acc.address.slice(0, 4)}…
              </Badge>
            </DropdownMenuItem>
          )),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
