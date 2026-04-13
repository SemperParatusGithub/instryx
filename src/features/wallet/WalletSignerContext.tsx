/**
 * Provides a TransactionSendingSigner derived from the currently connected wallet.
 *
 * React's rules prohibit conditional hook calls, so we cannot call
 * useWalletAccountTransactionSendingSigner only when a wallet is connected.
 * The solution: render a different inner component that *always* has a non-null
 * account, so the hook is always called with a valid value.
 */
import { createContext, useContext, Component } from 'react'
import type { ReactNode } from 'react'
import {
  useSelectedWalletAccount,
  useWalletAccountTransactionSendingSigner,
} from '@solana/react'
import type { UiWalletAccount } from '@wallet-standard/ui'
import type { TransactionSendingSigner } from '@solana/kit'
import { useNetworkStore } from '@/stores/networkStore'
import { networkToChainId } from './useWalletContext'

const WalletSignerContext = createContext<TransactionSendingSigner | null>(null)

// Error boundary so a throw inside SignerProviderInner (e.g. unsupported
// feature, unexpected chain) produces a null signer instead of crashing the app.
class SignerErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

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

const NullSignerProvider = ({ children }: { children: ReactNode }) => (
  <WalletSignerContext.Provider value={null}>{children}</WalletSignerContext.Provider>
)

/** Wrap the app with this provider (inside SelectedWalletAccountContextProvider). */
export function WalletSignerProvider({ children }: { children: ReactNode }) {
  const [account] = useSelectedWalletAccount()
  if (account) {
    return (
      <SignerErrorBoundary fallback={<NullSignerProvider>{children}</NullSignerProvider>}>
        <SignerProviderInner account={account}>{children}</SignerProviderInner>
      </SignerErrorBoundary>
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
