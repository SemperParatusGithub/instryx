import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StoredIdl } from '@/types'

interface IdlState {
  idls: StoredIdl[]
  activeIdlId: string | null
  addIdl: (idl: StoredIdl) => void
  removeIdl: (id: string) => void
  setActiveIdl: (id: string | null) => void
  getActiveIdl: () => StoredIdl | null
}

export const useIdlStore = create<IdlState>()(
  persist(
    (set, get) => ({
      idls: [],
      activeIdlId: null,
      addIdl: (idl) =>
        set((state) => ({
          idls: [...state.idls.filter((i) => i.id !== idl.id), idl],
          activeIdlId: idl.id,
        })),
      removeIdl: (id) =>
        set((state) => {
          const remaining = state.idls.filter((i) => i.id !== id)
          return {
            idls: remaining,
            activeIdlId:
              state.activeIdlId === id ? (remaining[0]?.id ?? null) : state.activeIdlId,
          }
        }),
      setActiveIdl: (id) => set({ activeIdlId: id }),
      getActiveIdl: () => {
        const { idls, activeIdlId } = get()
        return idls.find((i) => i.id === activeIdlId) ?? null
      },
    }),
    { name: 'instryx-idls' },
  ),
)
