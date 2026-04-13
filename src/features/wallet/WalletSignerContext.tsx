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

/**
 * Resolve the best chain ID to use for signing.
 * Wallets like Phantom only advertise solana:mainnet and solana:devnet —
 * they don't list solana:localnet even though they can sign any Solana tx.
 * Fall back to the first solana: chain the account supports so the hook
 * never throws due to an unsupported chain.
 */
function resolveChain(
  account: UiWalletAccount,
  preferred: `solana:${string}`,
): `solana:${string}` {
  if (account.chains.includes(preferred)) return preferred
  const fallback = account.chains.find((c) => c.startsWith('solana:'))
  return (fallback ?? preferred) as `solana:${string}`
}

/** Inner component — only mounted when account is non-null, so the hook is always valid. */
function SignerProviderInner({
  account,
  children,
}: {
  account: UiWalletAccount
  children: React.ReactNode
}) {
  const { network } = useNetworkStore()
  const chainId = resolveChain(account, networkToChainId(network))
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
