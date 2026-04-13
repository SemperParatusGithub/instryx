import { NavLink } from 'react-router-dom'
import {
  Wallet,
  FileJson,
  Database,
  Zap,
  Search,
  KeyRound,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useIdlStore } from '@/stores/idlStore'
import { WalletButton } from '@/features/wallet/WalletButton'

const NAV_ITEMS = [
  { to: '/network', icon: Layers, label: 'Network' },
  { to: '/idl', icon: FileJson, label: 'Programs' },
  { to: '/accounts', icon: Database, label: 'Accounts' },
  { to: '/instructions', icon: Zap, label: 'Instructions' },
  { to: '/transactions', icon: Search, label: 'Transactions' },
  { to: '/keypairs', icon: KeyRound, label: 'Keypairs' },
]

export function Sidebar() {
  const { idls, activeIdlId, setActiveIdl } = useIdlStore()

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Wallet className="size-5 text-primary" />
        <span className="font-semibold text-sidebar-foreground tracking-tight">Instryx</span>
      </div>

      <ScrollArea className="flex-1">
        {/* Main nav */}
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

        {/* Loaded IDLs */}
        {idls.length > 0 && (
          <>
            <Separator className="mx-2 my-2" />
            <div className="px-4 pb-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Loaded Programs
              </p>
            </div>
            <div className="p-2 space-y-0.5">
              {idls.map((stored) => (
                <button
                  key={stored.id}
                  onClick={() => setActiveIdl(stored.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors truncate',
                    stored.id === activeIdlId
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <FileJson className="size-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{stored.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </ScrollArea>

      {/* Wallet connect at the bottom */}
      <div className="p-3 border-t border-border">
        <WalletButton />
      </div>
    </aside>
  )
}
