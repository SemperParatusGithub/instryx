import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AddressBookEntry } from '@/types'

interface AddressBookState {
  entries: AddressBookEntry[]
  addEntry: (entry: Omit<AddressBookEntry, 'id'>) => void
  removeEntry: (id: string) => void
  updateEntry: (id: string, updates: Partial<Omit<AddressBookEntry, 'id'>>) => void
}

export const useAddressBookStore = create<AddressBookState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, id: crypto.randomUUID() },
          ],
        })),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
    }),
    { name: 'instryx-address-book' },
  ),
)
