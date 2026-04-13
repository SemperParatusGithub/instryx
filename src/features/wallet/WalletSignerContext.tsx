/**
 * Provides a TransactionSendingSigner derived from the currently connected wallet.
 *
 * React's rules prohibit conditional hook calls, so we cannot call
 * useWalletAccountTransactionSendingSigner only when a wallet is connected.
 * The solution: render a different inner component that *always* has a non-null
 * account, so the hook is always called with a valid value.
 */
import { createContext, useContext } from 'react'
import {
  useSelectedWalletAccount,
  useWalletAccountTransactionSendingSigner,
} from '@solana/react'
import type { UiWalletAccount } from '@wallet-standard/ui'
import type { TransactionSendingSigner } from '@solana/kit'
import { useNetworkStore } from '@/stores/networkStore'
import { networkToChainId } from './useWalletContext'

const WalletSignerContext = createContext<TransactionSendingSigner | null>(null)

/** Inner component — only mounted when account is non-null, so the hook is always valid. */
function SignerProviderInner({
  account,
  children,
}: {
  account: UiWalletAccount
  children: React.ReactNode
}) {
  const { network } = useNetworkStore()
  const chainId = networkToChainId(network)
  const signer = useWalletAccountTransactionSendingSigner(account, chainId)
  return (
    <WalletSignerContext.Provider value={signer}>
      {children}
    </WalletSignerContext.Provider>
  )
}

/** Wrap the app with this provider (inside SelectedWalletAccountContextProvider). */
export function WalletSignerProvider({ children }: { children: React.ReactNode }) {
  const [account] = useSelectedWalletAccount()
  if (account) {
    return (
      <SignerProviderInner account={account}>{children}</SignerProviderInner>
    )
  }
  return (
    <WalletSignerContext.Provider value={null}>
      {children}
    </WalletSignerContext.Provider>
  )
}

/** Returns the current wallet's TransactionSendingSigner, or null if not connected. */
export function useWalletSigner() {
  return useContext(WalletSignerContext)
}
