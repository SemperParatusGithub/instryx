import { NavLink } from 'react-router-dom'
import {
  Wallet,
  FileJson,
  Database,
  Zap,
  Search,
  KeyRound,
  Layers,
  HardDrive,
  GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WalletButton } from '@/features/wallet/WalletButton'

const NAV_ITEMS = [
  { to: '/network', icon: Layers, label: 'Network' },
  { to: '/programs', icon: HardDrive, label: 'Programs' },
  { to: '/idl', icon: FileJson, label: 'IDL Explorer' },
  { to: '/accounts', icon: Database, label: 'Accounts' },
  { to: '/instructions', icon: Zap, label: 'Instructions' },
  { to: '/transactions', icon: Search, label: 'Transactions' },
  { to: '/keypairs', icon: KeyRound, label: 'Keypairs' },
  { to: '/pda', icon: GitBranch, label: 'PDA Deriver' },
]

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Wallet className="size-5 text-primary" />
        <span className="font-semibold text-sidebar-foreground tracking-tight">Instryx</span>
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      {/* Wallet connect at the bottom */}
      <div className="p-3 border-t border-border">
        <WalletButton />
      </div>
    </aside>
  )
}
