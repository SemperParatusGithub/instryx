import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from '@solana/react'
import type { UiWalletAccount } from '@wallet-standard/ui'
import { useNetworkStore } from '@/stores/networkStore'
import type { Network } from '@/types'

export function networkToChainId(network: Network): `solana:${string}` {
  switch (network) {
    case 'mainnet': return 'solana:mainnet'
    case 'devnet': return 'solana:devnet'
    case 'localnet': return 'solana:localnet'
    case 'custom': return 'solana:devnet'
  }
}

export function useWalletContext() {
  const { network } = useNetworkStore()
  const [account, setAccount, wallets] = useSelectedWalletAccount()
  const chainId = networkToChainId(network)

  // We always call this hook unconditionally (React rule), but only use the result when account exists.
  // Cast account to satisfy the required non-nullable type; we guard usage with isConnected.
  const signer = useWalletAccountTransactionSendingSigner(
    account as UiWalletAccount,
    chainId,
  )

  return {
    account: account ?? null,
    setAccount,
    wallets,
    signer: account ? signer : null,
    isConnected: Boolean(account),
    walletAddress: account?.address ?? null,
    chainId,
  }
}
