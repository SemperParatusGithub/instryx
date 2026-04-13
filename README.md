# Instryx — Solana Program Developer Toolkit

A visual, browser-based interface for interacting with Solana programs. Think of it as **Postman for Solana** — load an Anchor IDL, invoke instructions, inspect accounts, and send real transactions, all without writing a single test script.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Quick Start](#quick-start)
- [Connecting to a Network](#connecting-to-a-network)
- [Connecting Your Wallet](#connecting-your-wallet)
- [Loading an IDL (Programs)](#loading-an-idl-programs)
- [Invoking Instructions](#invoking-instructions)
  - [Simulating](#simulating)
  - [Sending a Transaction](#sending-a-transaction)
  - [PDA Derivation](#pda-derivation)
- [Account Management](#account-management)
  - [Inspecting an Account](#inspecting-an-account)
  - [Decoding Account Data](#decoding-account-data)
  - [Creating an Account](#creating-an-account)
  - [Transferring SOL](#transferring-sol)
  - [Address Book](#address-book)
- [Transaction Inspector](#transaction-inspector)
- [Keypair Manager](#keypair-manager)
- [Deploying / Hosting](#deploying--hosting)
- [Tech Stack](#tech-stack)

---

## What It Does

| Feature | Description |
|---|---|
| **Network selector** | Switch between Localnet, Devnet, Mainnet, or any custom RPC URL |
| **Wallet connect** | Connects to any Wallet Standard wallet (Phantom, Backpack, Solflare, etc.) |
| **IDL loader** | Upload or paste an Anchor IDL JSON — the UI generates forms for every instruction |
| **Instruction invocation** | Fill in accounts and arguments, simulate or send real transactions |
| **PDA derivation** | Derive a Program Derived Address from seeds and auto-fill it into account fields |
| **Account inspector** | Fetch and display any account's lamports, owner, size, and raw data |
| **Account decoder** | Decode account data using the types defined in a loaded IDL |
| **Create account** | Allocate a new on-chain account via the System Program |
| **Transfer SOL** | Send SOL from your wallet to any address |
| **Transaction inspector** | Browse recent transactions for an address, or look up by signature |
| **Keypair manager** | Generate or import keypairs, encrypted in-browser with AES-256-GCM |

Everything is **client-side only** — no backend, no database, no Docker. All data is persisted in `localStorage`.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Wallet Standard wallet browser extension (e.g. [Phantom](https://phantom.app), [Backpack](https://backpack.app), or [Solflare](https://solflare.com))
- For local testing: [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) with `solana-test-validator`

### Run locally

```bash
# Clone the repo
git clone https://github.com/SemperParatusGithub/instryx.git
cd instryx

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
# Output is in dist/ — deploy anywhere that serves static files
```

---

## Connecting to a Network

Go to **Network** in the sidebar.

1. Pick a network from the dropdown:
   - **Localnet** — connects to `http://127.0.0.1:8899` (your local `solana-test-validator`)
   - **Devnet** — `https://api.devnet.solana.com`
   - **Mainnet** — `https://api.mainnet-beta.solana.com`
   - **Custom RPC** — enter any HTTP(S) RPC URL
2. Click **Test Connection** to verify the endpoint is reachable.
3. A green "Connected" indicator confirms the RPC is live.

### Airdrop (Localnet / Devnet only)

Enter a public key, set an amount in SOL, and click **Request Airdrop**. Not available on mainnet.

### Balance lookup

Enter any public key in the **Account Balance** panel to fetch its SOL balance.

---

## Connecting Your Wallet

The wallet button is at the **bottom of the sidebar**.

- If a Wallet Standard wallet extension is installed and has at least one account, it will appear automatically.
- Click **Connect [Wallet Name]** to connect.
- Once connected, the button shows your truncated address. Click it to copy your address or disconnect.
- The selected wallet is remembered across page refreshes.

> **Tip:** Instryx uses the [Wallet Standard](https://github.com/wallet-standard/wallet-standard) protocol. Any compliant wallet (Phantom, Backpack, Solflare, etc.) is auto-discovered — no manual configuration required.

---

## Loading an IDL (Programs)

Go to **Programs** in the sidebar.

### Upload a file

1. Click **Upload File** and select your Anchor IDL `.json` file.
2. The IDL is validated, parsed, and immediately displayed.

### Paste JSON

1. Switch to the **Paste JSON** tab.
2. Paste the full IDL JSON text.
3. Click **Load IDL**.

### Managing loaded IDLs

- Each loaded IDL appears as a card showing program name, ID, instruction count, and version.
- Click **Show instructions** to expand the list of available instructions.
- Use the **Use** button to make an IDL the active one used by the Instructions and Accounts pages.
- Multiple IDLs can be loaded at once — switch between them using the sidebar or the selector on the Instructions page.
- IDLs are persisted in `localStorage` and survive page refreshes.
- Click the **trash icon** to remove an IDL.

---

## Invoking Instructions

Go to **Instructions** in the sidebar. You must have at least one IDL loaded.

Each instruction defined in the IDL gets its own collapsible card. Click the card header to expand it.

### Filling in accounts

For each required account you'll see an input field labelled with the account name. Badges indicate:
- **signer** — this account must sign the transaction
- **writable** — this account will be modified
- **optional** — can be left blank

Accounts marked as `signer` are auto-populated with your connected wallet address if one is connected. Override any field by typing a different address.

### Filling in arguments

Each argument shows its Anchor type (e.g. `u64`, `String`, `Pubkey`, `bool`). Fill in values as plain text:
- Integers: plain numbers (`42`, `1000000`)
- Booleans: toggle switch
- Public keys: base58 address string
- Vecs / arrays / structs: JSON (e.g. `[1,2,3]` or `{"x":1}`)

### Simulating

Click **Simulate** to run a dry-run via `simulateTransaction`. No wallet required for simulation — it uses a no-op signer. The result shows:
- Pass / fail status
- Program logs
- Compute units consumed
- Error details (if failed)

### Sending a Transaction

Click **Send** to sign and broadcast the transaction. **A connected wallet is required.**

The wallet popup will ask for your approval. After confirmation:
- The transaction signature is displayed
- A direct link to [Solana Explorer](https://explorer.solana.com) is shown

> **Safety:** Always simulate before sending. The app never signs anything without your explicit wallet approval.

### PDA Derivation

If an account field has a PDA defined in the IDL, a **+ derive PDA** link appears. You can also open the deriver manually for any account field:

1. Click **+ derive PDA** next to the account field.
2. Add seeds using the **+ Add Seed** button. Each seed has a type:
   - `string` — UTF-8 text (e.g. `"vault"`)
   - `pubkey` — a base58 public key
   - `u8` / `u64` — integer, encoded little-endian
   - `bytes` — comma-separated decimals (`1,2,3`) or hex (`0x010203`)
3. Click **Derive**.
4. The derived address and bump seed are shown. Click **Use** to auto-fill the account field.

---

## Account Management

Go to **Accounts** in the sidebar.

### Inspecting an Account

1. In the **View / Inspect** tab, enter any public key.
2. Press Enter or click the search button.
3. The account view shows:
   - Lamport balance (and SOL equivalent)
   - Data size
   - Owner program
   - Executable flag
   - Raw data (base64)
4. A direct Solana Explorer link is shown for the address.
5. Click **Refresh** to re-fetch after a transaction.

### Decoding Account Data

After fetching an account, click **Decode with IDL**. Instryx will try to deserialize the raw account data against every account type defined in the active IDL using `BorshAccountsCoder`. If a match is found, the decoded fields are displayed as formatted JSON.

> The active IDL must contain the account type that matches the fetched account's discriminator.

### Creating an Account

Go to the **Create** tab.

1. **Owner Program** — the program ID that will own the account (default: System Program).
2. **Space (bytes)** — how many bytes to allocate. Click **Get Rent** to calculate the minimum rent-exempt lamport amount for that size.
3. **Lamports** — leave blank to use the rent-exempt minimum, or enter a custom amount.
4. Click **Create Account**. A wallet popup will appear.

A new Ed25519 keypair is generated in-browser for the new account. After confirmation:
- The new account's address is displayed.
- A link to the transaction is shown.

### Transferring SOL

Go to the **Transfer SOL** tab.

1. Enter the **Recipient** address.
2. Enter the **Amount** in SOL.
3. Click **Send SOL**. A wallet popup will appear.

Uses the System Program's `transfer` instruction via `@solana-program/system`.

### Address Book

The **Address Book** tab lets you save frequently used addresses:
- Save any inspected account directly from the View / Inspect tab using **Save to Book**.
- Add addresses manually with a label.
- Click **Inspect** from the address book to jump straight to an account's details.
- Entries are persisted in `localStorage`.

---

## Transaction Inspector

Go to **Transactions** in the sidebar.

### By Account

1. Enter an account or program public key.
2. Click Search to fetch the 25 most recent transactions.
3. Each transaction row shows status (OK / Fail), a truncated signature, and timestamp.
4. Click **Details** to fetch the full transaction: slot, time, fee, compute units, balance changes, and program logs.

### By Signature

Switch to the **By Signature** tab, enter a full transaction signature, and click **Fetch**.

Both views include a **Explorer** link that opens Solana Explorer in the correct cluster (devnet, mainnet, or localnet).

---

## Keypair Manager

Go to **Keypairs** in the sidebar.

> **Security:** Private keys are encrypted with AES-256-GCM using a PBKDF2-derived key before being stored in `localStorage`. They are never stored or logged in plaintext.

### Generate a new keypair

1. Click **Generate Keypair**.
2. Enter a label and a password (used to encrypt the private key).
3. Confirm the password and click **Generate**.

The public key is immediately displayed. Click the eye icon to show/hide the full address.

### Import an existing keypair

1. Click **Import**.
2. Select a Solana CLI keypair JSON file (the standard `[byte, byte, ...]` format output by `solana-keygen`).
3. Enter a label and an encryption password.
4. Click **Import & Encrypt**.

### Export a keypair

Click the **download icon** on any keypair card. You'll be prompted for the password you used when creating/importing it. A Solana CLI-compatible JSON file is downloaded.

### Using keypairs as transaction signers

Keypair accounts are not yet wired as transaction signers in the UI (that's a planned v1.1 feature). For now, use them as address references or export them for use with the Solana CLI.

---

## Deploying / Hosting

The app is a pure static SPA — just serve the contents of `dist/`.

```bash
npm run build
```

### Vercel

```bash
npx vercel --prod
```

### Netlify

Drag and drop the `dist/` folder at [app.netlify.com](https://app.netlify.com).

### GitHub Pages

Use any static site GitHub Action to deploy `dist/` to the `gh-pages` branch.

### Local validator + hosted app

If you're using the hosted version against a local validator:
1. Set **Network** → **Custom RPC** → `http://localhost:8899`
2. Make sure your `solana-test-validator` is running with CORS enabled:
   ```bash
   solana-test-validator --rpc-port 8899
   ```
3. Some browsers block mixed-content (HTTPS page → HTTP RPC). Use the locally-run dev server or a browser extension that allows mixed content for local development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Framework | React 19 |
| Build | Vite 8 |
| Solana SDK | `@solana/kit` (web3.js v2) |
| Wallet | `@solana/react` + Wallet Standard |
| System Program | `@solana-program/system` |
| IDL / encoding | `@coral-xyz/anchor` (client-side only) |
| UI | shadcn/ui + Tailwind CSS v4 |
| State | Zustand (all stores persisted) |
| Forms | React Hook Form |
| Routing | React Router v7 |
| Notifications | Sonner |
