import { useMemo } from 'react'
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit'
import { useNetworkStore } from '@/stores/networkStore'

export function useConnection() {
  const { rpcUrl, wsUrl } = useNetworkStore()

  const rpc = useMemo(() => {
    try {
      return createSolanaRpc(rpcUrl)
    } catch {
      return null
    }
  }, [rpcUrl])

  const rpcSubscriptions = useMemo(() => {
    if (!wsUrl) return null
    try {
      return createSolanaRpcSubscriptions(wsUrl)
    } catch {
      return null
    }
  }, [wsUrl])

  return { rpc, rpcSubscriptions }
}
