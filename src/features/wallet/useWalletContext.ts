import { useSelectedWalletAccount } from '@solana/react'
import { useNetworkStore } from '@/stores/networkStore'
import { useWalletSigner } from './WalletSignerContext'
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
  const signer = useWalletSigner()
  const chainId = networkToChainId(network)

  return {
    account: account ?? null,
    setAccount,
    wallets,
    signer,                          // null when not connected, valid signer when connected
    isConnected: Boolean(account),
    walletAddress: account?.address ?? null,
    chainId,
  }
}
