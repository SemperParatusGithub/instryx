import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Network, NetworkConfig } from '@/types'

const NETWORK_PRESETS: Record<Network, Omit<NetworkConfig, 'network'>> = {
  localnet: {
    rpcUrl: 'http://127.0.0.1:8899',
    wsUrl: 'ws://127.0.0.1:8900',
  },
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    wsUrl: 'wss://api.devnet.solana.com',
  },
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    wsUrl: 'wss://api.mainnet-beta.solana.com',
  },
  custom: {
    rpcUrl: '',
    wsUrl: '',
  },
}

interface NetworkState extends NetworkConfig {
  customRpcUrl: string
  isConnected: boolean
  setNetwork: (network: Network) => void
  setCustomRpcUrl: (url: string) => void
  setIsConnected: (connected: boolean) => void
  getActiveRpcUrl: () => string
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      network: 'devnet',
      rpcUrl: NETWORK_PRESETS.devnet.rpcUrl,
      wsUrl: NETWORK_PRESETS.devnet.wsUrl,
      customRpcUrl: '',
      isConnected: false,
      setNetwork: (network) => {
        const preset = NETWORK_PRESETS[network]
        set({
          network,
          rpcUrl: network === 'custom' ? get().customRpcUrl : preset.rpcUrl,
          wsUrl: network === 'custom' ? '' : preset.wsUrl,
          isConnected: false,
        })
      },
      setCustomRpcUrl: (url) => {
        set({ customRpcUrl: url })
        if (get().network === 'custom') {
          set({ rpcUrl: url, isConnected: false })
        }
      },
      setIsConnected: (connected) => set({ isConnected: connected }),
      getActiveRpcUrl: () => {
        const { network, rpcUrl, customRpcUrl } = get()
        return network === 'custom' ? customRpcUrl : rpcUrl
      },
    }),
    { name: 'instryx-network' },
  ),
)
