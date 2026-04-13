import { SelectedWalletAccountContextProvider } from '@solana/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

const WALLET_STORAGE_KEY = 'instryx-wallet'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SelectedWalletAccountContextProvider
      filterWallets={(wallet) => wallet.accounts.length > 0}
      stateSync={{
        getSelectedWallet: () => localStorage.getItem(WALLET_STORAGE_KEY),
        storeSelectedWallet: (key) => localStorage.setItem(WALLET_STORAGE_KEY, key),
        deleteSelectedWallet: () => localStorage.removeItem(WALLET_STORAGE_KEY),
      }}
    >
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          closeButton
        />
      </TooltipProvider>
    </SelectedWalletAccountContextProvider>
  )
}
