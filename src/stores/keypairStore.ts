import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StoredKeypair } from '@/types'

interface KeypairState {
  keypairs: StoredKeypair[]
  addKeypair: (keypair: StoredKeypair) => void
  removeKeypair: (id: string) => void
  updateLabel: (id: string, label: string) => void
}

export const useKeypairStore = create<KeypairState>()(
  persist(
    (set) => ({
      keypairs: [],
      addKeypair: (keypair) =>
        set((state) => ({ keypairs: [...state.keypairs, keypair] })),
      removeKeypair: (id) =>
        set((state) => ({ keypairs: state.keypairs.filter((k) => k.id !== id) })),
      updateLabel: (id, label) =>
        set((state) => ({
          keypairs: state.keypairs.map((k) => (k.id === id ? { ...k, label } : k)),
        })),
    }),
    { name: 'instryx-keypairs' },
  ),
)
