import { useState } from 'react'
import { useWallets, useConnect } from '@wallet-standard/react'
import { useSelectedWalletAccount } from '@solana/react'
import type { UiWallet, UiWalletAccount } from '@wallet-standard/ui'
import { Wallet, ChevronDown, LogOut, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

/** Per-wallet option — useConnect must be called once per wallet (not in a loop). */
function WalletOption({
  wallet,
  onSelect,
}: {
  wallet: UiWallet
  onSelect: (acc: UiWalletAccount) => void
}) {
  const [isConnecting, connect] = useConnect(wallet)

  if (wallet.accounts.length > 0) {
    return (
      <>
        {wallet.accounts.map((acc) => (
          <DropdownMenuItem key={acc.address} onClick={() => onSelect(acc)}>
            <img
              src={wallet.icon}
              alt={wallet.name}
              className="size-4 rounded-sm shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span className="truncate">{wallet.name}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {truncate(acc.address)}
            </span>
          </DropdownMenuItem>
        ))}
      </>
    )
  }

  return (
    <DropdownMenuItem
      disabled={isConnecting}
      onClick={async () => {
        try {
          const accounts = await connect()
          if (accounts[0]) onSelect(accounts[0])
        } catch (e) {
          toast.error('Connection rejected: ' + (e instanceof Error ? e.message : String(e)))
        }
      }}
    >
      {isConnecting ? (
        <Loader2 className="size-4 animate-spin shrink-0" />
      ) : (
        <img
          src={wallet.icon}
          alt={wallet.name}
          className="size-4 rounded-sm shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      <span className="truncate">
        {isConnecting ? `Connecting to ${wallet.name}…` : `Connect ${wallet.name}`}
      </span>
    </DropdownMenuItem>
  )
}

export function WalletButton() {
  const wallets = useWallets()
  const [account, setAccount] = useSelectedWalletAccount()
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!account?.address) return
    navigator.clipboard.writeText(account.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  // Connected state
  if (account) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-green-500 shrink-0" />
              {truncate(account.address)}
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 text-xs text-muted-foreground font-mono break-all">
            {account.address}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copy}>
            {copied
              ? <CheckCircle2 className="size-3.5 mr-2 text-green-500" />
              : <Copy className="size-3.5 mr-2" />}
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

  // Not connected — no wallets detected
  if (wallets.length === 0) {
    return (
      <Button variant="outline" size="sm" className="w-full text-xs" disabled>
        <Wallet className="size-3.5 mr-1.5" />
        No wallet detected
      </Button>
    )
  }

  // Not connected — show wallet list
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
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Detected wallets
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {wallets.map((wallet) => (
          <WalletOption key={wallet.name} wallet={wallet} onSelect={setAccount} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
