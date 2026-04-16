# Instryx

**The developer toolbox for Solana. Deploy programs, invoke instructions, inspect accounts, derive PDAs, manage keypairs — all in one place, all in the browser.**

No backend. No CLI required. No context switching. Just open the app and build.

---

## Why Instryx

Solana development is powerful but fragmented. You write your program in one terminal, deploy it in another, test transactions with custom scripts, and hunt for PDAs with a calculator. Instryx replaces all of that with a unified visual interface designed specifically for Solana developers.

Whether you're hacking on localnet at 2am or debugging a devnet deployment before launch, Instryx has every tool you need in one tab.

---

## What's Inside

### Programs
Upload your compiled `.so` binary, IDL, and keypair — or just point at your Anchor `target/` directory and Instryx auto-imports everything. Deploy to localnet with one click (auto-airdrop included), or follow the guided fee-payer flow for devnet and mainnet.

### Instruction Invoker
Select an instruction from your IDL, fill in accounts with a typed form (signer/writable badges, address book picker), provide arguments with full type coercion (u64, Vec<u8>, Pubkey, bool...), then **simulate** to inspect logs and compute units, or **send** to land the transaction on-chain.

### PDA Deriver
Build seeds from typed fields — strings, integers, public keys, raw bytes — and get the derived address and bump in real time as you type. Copy the PDA directly into any account field.

### Account Inspector
Fetch any on-chain account, see its lamports, owner, and data size, and decode the raw bytes against your IDL using Borsh. Create accounts, transfer SOL, and save addresses to your address book.

### Transaction Inspector
Look up any transaction by signature, or browse the recent history for any account. See slot, fee, compute units, balance changes, and program logs — with direct Solana Explorer links.

### Keypair Manager
Generate or import keypairs, encrypted in-browser with AES-256-GCM. Export them as standard Solana CLI `.json` files. Never store a private key in plaintext.

---

## Feature Highlights

| | |
|---|---|
| **One-click localnet deploy** | Auto-generates a fee-payer keypair, airdrops SOL, and deploys — no CLI touch required |
| **Anchor-aware** | Reads `declare_id!()` from your IDL, validates your keypair matches, warns you before a bad deploy |
| **Quick Import** | Select your Anchor `target/` folder and Instryx auto-matches `.so`, `-keypair.json`, and IDL by name |
| **Byte field builder** | Compose `Vec<u8>` arguments from typed fields: u8, u16, string, pubkey, hex bytes — with live hex preview |
| **Live PDA derivation** | PDAs recompute on every keystroke, no button required |
| **Wallet Standard** | Auto-discovers Phantom, Backpack, Solflare, and any other compliant wallet — zero config |
| **Address book** | Save any address with a label, pick it from any account input across the entire app |
| **100% client-side** | No server, no database, no Docker. All state lives in `localStorage`. Deploy to any static host |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Wallet Standard wallet extension ([Phantom](https://phantom.app), [Backpack](https://backpack.app), [Solflare](https://solflare.com))
- For local testing: [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) + `solana-test-validator`

```bash
git clone https://github.com/SemperParatusGithub/instryx.git
cd instryx
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
# Production build — deploy the dist/ folder anywhere
npm run build
```

---

## The Full Workflow

Here's what a complete Anchor development cycle looks like with Instryx:

```
1. anchor build                         # compile your program

2. Open Instryx → Programs
   → "Select Anchor target/ directory"  # auto-loads .so + keypair + IDL

3. Deploy tab → "Deploy to Localnet"    # one click, auto-airdropped

4. Invoke tab → pick instruction        # typed form, address book, simulate first

5. Accounts → inspect the account       # decode with IDL, see your data live

6. PDA Deriver → add seeds              # copy the PDA into your next instruction
```

No scripts. No curl. No `console.log` in a test file.

---

## Deploying Programs

1. Go to **Programs → Upload Program**
2. Click **"Select Anchor target/ directory"** — Instryx finds the `.so`, keypair, and IDL automatically
3. Click **Deploy** on the Deploy tab
   - **Localnet**: fee-payer is auto-generated and airdropped — just click
   - **Devnet**: generate a fee-payer keypair in-app, airdrop to it, then deploy
   - **Mainnet**: copy the generated fee-payer address, fund it externally, then deploy

If your keypair doesn't match the `declare_id!()` in your IDL, Instryx warns you before you deploy — and tells you exactly which addresses conflict.

---

## Invoking Instructions

Go to **Programs → Invoke** (requires an uploaded program with an IDL).

- Pick an instruction from the dropdown
- Fill in accounts — signer accounts default to your wallet; pick any address from the address book
- Fill in arguments — `Vec<u8>` args get a full field builder (add u8, string, pubkey, hex fields with live hex preview)
- Click **Simulate** to dry-run without spending SOL
- Click **Send** to broadcast (wallet approval required)

---

## Deriving PDAs

Go to **PDA Deriver** in the sidebar.

1. Enter your program ID (or pick from the address book)
2. Click **Add Seed** and choose the seed type
3. The PDA and bump are derived in real time
4. Copy the address with one click

Supported seed types: `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64`, `string`, `pubkey`, `bytes`.

---

## Security

- All private keys are encrypted with **AES-256-GCM** using a PBKDF2-derived key before touching `localStorage`
- No data ever leaves your browser — there is no server, no analytics, no telemetry
- Transactions are only signed with your explicit wallet approval

---

## Tech Stack

| | |
|---|---|
| Language | TypeScript (strict) |
| Framework | React 19 |
| Build tool | Vite |
| Solana SDK | `@solana/kit` (web3.js v2) |
| Wallet | `@solana/react` + Wallet Standard |
| IDL / encoding | `@coral-xyz/anchor` |
| UI components | shadcn/ui + Tailwind CSS v4 |
| State | Zustand (persisted) |
| Forms | React Hook Form |
| Routing | React Router v7 |

---

## Roadmap

- [ ] Token accounts — view SPL token balances, mint info, and ATAs
- [ ] Program upgrade — upgrade a deployed Anchor program in-place
- [ ] Anchor CPI explorer — visualize cross-program invocations in a transaction
- [ ] Shareable links — encode instruction calls as URLs
- [ ] Keypairs as transaction signers — sign instructions directly with in-app keypairs

---

## Contributing

Issues and PRs are welcome. TypeScript strict mode throughout. UI features live in `src/features/`, shared Solana utilities in `src/lib/solana/`, Zustand stores in `src/stores/`.

---

*Built for Solana developers who want to move fast.*
