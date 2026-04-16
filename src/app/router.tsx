import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { NetworkPage } from '@/features/network/NetworkPage'
import { IdlPage } from '@/features/idl/IdlPage'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { InstructionsPage } from '@/features/instructions/InstructionsPage'
import { TransactionsPage } from '@/features/transactions/TransactionsPage'
import { KeypairsPage } from '@/features/keypairs/KeypairsPage'
import { ProgramsPage } from '@/features/programs/ProgramsPage'
import { PdaPage } from '@/features/pda/PdaPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/network" replace /> },
      { path: 'network', element: <NetworkPage /> },
      { path: 'programs', element: <ProgramsPage /> },
      { path: 'idl', element: <IdlPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'instructions', element: <InstructionsPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'keypairs', element: <KeypairsPage /> },
      { path: 'pda', element: <PdaPage /> },
    ],
  },
])
