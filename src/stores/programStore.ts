import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StoredProgram, AnchorIdl } from '@/types'

interface ProgramState {
  programs: StoredProgram[]
  activeProgramId: string | null
  addProgram: (program: StoredProgram) => void
  removeProgram: (id: string) => void
  setActiveProgram: (id: string | null) => void
  getActiveProgram: () => StoredProgram | null
  recordDeployment: (id: string, network: string, programId: string) => void
  attachIdl: (id: string, idl: AnchorIdl) => void
}

export const useProgramStore = create<ProgramState>()(
  persist(
    (set, get) => ({
      programs: [],
      activeProgramId: null,

      addProgram: (program) =>
        set((state) => ({
          programs: [...state.programs.filter((p) => p.id !== program.id), program],
          activeProgramId: program.id,
        })),

      removeProgram: (id) =>
        set((state) => {
          const remaining = state.programs.filter((p) => p.id !== id)
          return {
            programs: remaining,
            activeProgramId:
              state.activeProgramId === id ? (remaining[0]?.id ?? null) : state.activeProgramId,
          }
        }),

      setActiveProgram: (id) => set({ activeProgramId: id }),

      getActiveProgram: () => {
        const { programs, activeProgramId } = get()
        return programs.find((p) => p.id === activeProgramId) ?? null
      },

      recordDeployment: (id, network, programId) =>
        set((state) => ({
          programs: state.programs.map((p) =>
            p.id === id
              ? {
                  ...p,
                  deployments: {
                    ...p.deployments,
                    [network]: { programId, deployedAt: Date.now() },
                  },
                }
              : p,
          ),
        })),

      attachIdl: (id, idl) =>
        set((state) => ({
          programs: state.programs.map((p) => (p.id === id ? { ...p, idl } : p)),
        })),
    }),
    { name: 'instryx-programs' },
  ),
)
