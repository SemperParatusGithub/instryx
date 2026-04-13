import { SelectedWalletAccountContextProvider } from '@solana/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { WalletSignerProvider } from '@/features/wallet/WalletSignerContext'

const WALLET_STORAGE_KEY = 'instryx-wallet'

// Stable stateSync object — must not be recreated on every render.
// SelectedWalletAccountContextProvider has effects that depend on stateSync;
// if it's a new object every render those effects run on every render and
// can interfere with the selected-account restoration logic.
const WALLET_STATE_SYNC = {
  getSelectedWallet: () => localStorage.getItem(WALLET_STORAGE_KEY),
  storeSelectedWallet: (key: string) => localStorage.setItem(WALLET_STORAGE_KEY, key),
  deleteSelectedWallet: () => localStorage.removeItem(WALLET_STORAGE_KEY),
}

// Stable filter — always admit all wallets so unconnected ones are still shown.
const FILTER_ALL_WALLETS = () => true

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SelectedWalletAccountContextProvider
      filterWallets={FILTER_ALL_WALLETS}
      stateSync={WALLET_STATE_SYNC}
    >
      <WalletSignerProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
          />
        </TooltipProvider>
      </WalletSignerProvider>
    </SelectedWalletAccountContextProvider>
  )
}
