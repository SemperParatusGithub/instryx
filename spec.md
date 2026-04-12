# Solana Program Developer Toolkit — Specification

## 1. Project Overview

A client-side web application that provides a visual interface for Solana program development and testing. It is designed to eliminate the need for writing repetitive test cases during development by letting developers interact with their programs directly through a browser UI.

The primary target audience is Solana developers working locally with `solana-test-validator`, but the app also supports devnet, mainnet, and any custom RPC endpoint — making it useful as a hosted tool anyone can access with their own wallet.

Think of it as a **visual Solana program explorer and instruction invoker** — like Postman, but for Solana programs.

---

## 2. Goals

- Rapidly test Anchor programs without writing test scripts
- Create and manage accounts visually
- Invoke program instructions with a dynamically generated UI derived from the Anchor IDL
- Inspect account data and transaction results in real time
- Support any network via configurable RPC URL
- Be fully client-side — no backend, no database, no Docker required

---

## 3. How the App Runs

The app is a **pure client-side single-page application (SPA)**. It has no backend server.

- Run locally with `npm run dev` (or `pnpm run dev`)
- Or deploy to a static host (Vercel, Netlify, GitHub Pages) for public access
- All Solana interactions go directly from the browser to the configured RPC endpoint
- The user manages their own wallet and RPC connection
- For local development, the user runs `solana-test-validator` separately and points the app to `http://localhost:8899`

---

## 4. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | Strict mode enabled |
| Framework | React 19 | Component-driven UI |
| Build Tool | Vite | Fast HMR, lightweight bundler |
| Solana SDK | `@solana/kit` | Modern non-deprecated SDK (formerly web3.js v2) |
| Wallet Integration | `@solana/wallet-standard-wallet-adapter-react` | Standard wallet adapter for Kit |
| Anchor IDL Parsing | `@coral-xyz/anchor` (client only) | Used only for IDL types and instruction encoding — NOT for RPC calls |
| UI Components | shadcn/ui + Tailwind CSS | Accessible, customizable component library |
| State Management | Zustand | Lightweight global state (wallet, network, IDL store) |
| Form Generation | React Hook Form + Zod | Dynamic form generation from IDL instruction arguments |
| Routing | React Router v7 | Client-side routing |
| Notifications | Sonner | Toast notifications for tx results and errors |

> **Important:** All RPC interactions use `@solana/kit` exclusively. `@coral-xyz/anchor` is used only for parsing IDL structure and encoding instruction data on the client side.

---

## 5. Supported Program Types

### Phase 1 — Anchor Programs
- Anchor programs expose an **IDL (Interface Definition Language)** JSON file
- The IDL describes all instructions, their arguments, and required accounts
- The app parses this IDL and dynamically generates a UI for each instruction
- IDL can be provided by:
  - Uploading a `.json` file
  - Pasting raw JSON into a text editor
  - (Future) Auto-fetching from a program ID on devnet/mainnet if the IDL is published on-chain

### Phase 2 — Pinocchio Programs (Future)
- Pinocchio programs do not natively produce an IDL
- A future feature will allow developers to **manually define an IDL** through a UI form
- This manually generated IDL will follow the Anchor IDL schema so the same instruction invocation UI can be reused
- The IDL builder UI will support defining:
  - Instructions and their arguments (name, type, optional/required)
  - Required accounts per instruction (signer, writable, PDA, etc.)
  - Account data schemas (for deserialization and display)

---

## 6. Core Features

### 6.1 Network & Wallet Configuration
- Network selector: **Localnet**, **Devnet**, **Mainnet**, **Custom RPC URL**
- Custom RPC URL input with connection status indicator
- Wallet connect button (supports all Wallet Standard wallets: Phantom, Backpack, Solflare, etc.)
- Display connected wallet address and SOL balance
- Airdrop button (available on localnet and devnet)

### 6.2 IDL Management
- Upload Anchor IDL JSON file
- Paste raw IDL JSON with syntax validation
- Display parsed program name, program ID, and list of instructions and accounts
- Persist loaded IDLs in `localStorage` so they survive page refreshes
- Support multiple IDLs loaded simultaneously (switchable via a sidebar or tab)
- Clear / remove loaded IDL

### 6.3 Account Management
- **Create Account**: Specify address (generate keypair or provide pubkey), space (bytes), owner program, and lamports (auto-calculated for rent exemption or custom)
- **View Account**: Inspect any account by public key — display lamports, owner, executable flag, and raw data
- **Decode Account Data**: If an IDL is loaded and the account matches a known account type, decode and display the data in a human-readable format
- **Fund Account**: Transfer SOL to any address
- **Close Account**: Reclaim lamports from an account (where applicable)
- Save frequently used accounts to a local address book (persisted in `localStorage`)

### 6.4 Instruction Invocation
- For each instruction defined in the loaded IDL, generate a form with:
  - Input fields for each argument (typed: `u8`, `u64`, `i32`, `bool`, `String`, `Pubkey`, etc.)
  - Account fields for each required account (with signer/writable indicators)
  - Auto-populate wallet address for signer accounts
  - Support for PDA derivation (seeds input + auto-derive button)
- Simulate transaction before sending (using `simulateTransaction`)
- Send transaction and display:
  - Transaction signature with explorer link
  - Logs output
  - Account state changes (before/after)
  - Error messages with decoded program error codes

### 6.5 Transaction Inspector
- View recent transactions for a given account or program
- Decode and display instruction data using the loaded IDL
- Display logs, compute units used, and fee

### 6.6 Keypair Manager
- Generate new keypairs in-browser
- Import keypairs from JSON file (Solana CLI format)
- Export keypairs to JSON file
- Use generated keypairs as signers in instruction invocations
- Store keypairs locally (encrypted with a password, stored in `localStorage`)

---

## 7. UI/UX Design Principles

- **Dark mode by default** — developer tools should be easy on the eyes
- **Sidebar navigation** for switching between features (Accounts, Programs, Transactions, Keypairs)
- **Responsive layout** — usable on wide monitors (primary) but not broken on smaller screens
- **Inline feedback** — errors, warnings, and success states shown inline, not just in toasts
- **Copy-to-clipboard** on all addresses, signatures, and keys
- **Keyboard shortcuts** for power users (e.g. `Cmd+Enter` to send transaction)

---

## 8. Data Persistence

All persistence is **client-side only** — no server, no cloud sync.

| Data | Storage |
|---|---|
| Loaded IDLs | `localStorage` |
| Address book | `localStorage` |
| Network preference | `localStorage` |
| Keypairs | `localStorage` (encrypted) |
| Recent transactions | `sessionStorage` or `localStorage` |

---

## 9. Project Structure

```
/
├── public/
├── src/
│   ├── app/                  # App shell, routing, providers
│   ├── components/           # Shared UI components
│   │   ├── ui/               # shadcn/ui base components
│   │   └── solana/           # Solana-specific components (AccountCard, TxResult, etc.)
│   ├── features/             # Feature modules
│   │   ├── network/          # RPC config, connection state
│   │   ├── wallet/           # Wallet connection and balance
│   │   ├── idl/              # IDL upload, parsing, storage
│   │   ├── accounts/         # Account creation, viewing, decoding
│   │   ├── instructions/     # Dynamic instruction form generation and invocation
│   │   ├── transactions/     # Transaction inspector
│   │   └── keypairs/         # Keypair generation and management
│   ├── lib/                  # Utility functions and helpers
│   │   ├── solana/           # Kit wrappers, PDA utils, encoding helpers
│   │   └── idl/              # IDL parsing and form schema generation
│   ├── stores/               # Zustand stores
│   └── types/                # Shared TypeScript types
├── spec.md                   # This file
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 10. Out of Scope (v1)

- Backend server or API
- Database or cloud persistence
- User authentication
- Program deployment from the UI
- Code editor or program compilation
- Mobile app
- Electron / Tauri wrapper (considered for v2)
- Pinocchio IDL builder (Phase 2)
- Auto-fetching on-chain IDL by program ID (nice-to-have, post-v1)

---

## 11. Future Roadmap

| Version | Feature |
|---|---|
| v1.1 | Auto-fetch published on-chain Anchor IDL by program ID |
| v1.2 | Improved PDA explorer and derivation tools |
| v2.0 | Pinocchio support with manual IDL builder UI |
| v2.1 | Tauri desktop wrapper with auto-managed `solana-test-validator` |
| v3.0 | Monorepo split with shared IDL parser package and optional CLI |

---

## 12. Development Notes for Claude Code

- Use `@solana/kit` for **all** RPC and transaction operations — never use `@solana/web3.js` v1
- Use `@coral-xyz/anchor` only for IDL type definitions and instruction data encoding
- All components should be typed — no `any`
- Prefer named exports over default exports
- Co-locate feature logic, components, and types within each feature folder
- Use Zod schemas derived from IDL argument types for form validation
- Wallet keypairs used as additional signers should be handled carefully — never log private keys
