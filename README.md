# FlowX — Intent-driven liquidity engine on X Layer

> Write one sentence. Three AI solvers compete. The winner runs on X Layer mainnet.

FlowX turns a plain-English request like *"deploy 1 USDT for best yield, low risk, 30 days"* into a real, signed, confirmed DeFi position on X Layer — selected by a 3-agent AI competition and executed through the OKX Onchain OS stack.

This repo (`fe-flowX`) is the **Next.js frontend**. The backend lives in [`be-flowX/flowx-api`](../be-flowX) (NestJS).

Submitted to **OKX Build X 2026 — X Layer Arena** (full-stack agentic application track), with secondary aim at the **Most Active Agent** tx-count prize.

---

## Why FlowX

DeFi on a new chain is painful. You juggle five tabs comparing APYs, eyeball impermanent loss, approve tokens one by one, sign half a dozen transactions, and hope you picked the right pool. Most people just… don't bother.

FlowX flips the UX: **describe what you want, and three specialized AI solvers compete to execute it for you.** Each solver owns a different strategy. The winning bid is scored, x402-paid, and executed on X Layer mainnet through the Agentic Wallet safety pipeline.

FlowX is — as far as we know — the **first public app** that wires four OKX Onchain OS products into a single request path:

1. **Agentic Wallet** — policy-checked, simulation-gated transaction sender.
2. **DEX V6 aggregator** — `smartSwap` routing for the `lp` strategy type.
3. **x402 Payments** — gasless EIP-3009 micropayment to unlock the flow.
4. **Onchain Gateway** — authoritative on-chain reads for pool state.

---

## User flow

1. **Connect wallet** via RainbowKit (OKX Wallet, Rabby, MetaMask, WalletConnect) on X Layer mainnet (`chainId 196`).
2. **Write your intent** in the single textarea on `/` — any language works. Example: *"Lend 1 USDT safest yield low risk 30 days."*
3. **Click Deploy.** The FE POSTs to `/api/flow`.
4. **Backend parses the intent** with Moonshot Kimi (via OpenRouter) into a typed DTO: `{amount, token, targetApy, risk, duration, maxIL, preferredProtocol, autoRebalance}`.
5. **x402 payment gate.** The backend replies `402 Payment Required` with a `PAYMENT-REQUIRED` header encoding the price (0.05 USDG) and asset. The FE signs an **EIP-3009 `TransferWithAuthorization`** on USDG, attaches it as `PAYMENT-SIGNATURE`, and replays the request. OKX's x402 facilitator settles gaslessly.
6. **Three solvers compete in parallel**:
   - **`lp-solver`** — scouts live Uniswap V3-style pools on X Layer via an on-chain pool registry + `liquidity()` reads. Computes fee APY, IL, confidence.
   - **`yield-solver`** — pulls DefiLlama pool data for X Layer, scores products on `apy × confidence × (1 − risk) + sustainability + tvl depth`.
   - **`risk-solver`** — pure risk assessor. Non-executable; it can disqualify unsafe bids.
7. **Orchestrator scores the bids** with `score = projectedApy × confidence × (1 − riskScore)` and picks the winner.
8. **The winner is routed** by `TradeService.executeStrategy()`:
   - `strategy.type === 'lp'` → `executeOnchain()` → **OKX DEX V6 `smartSwap`** through the exact Uniswap V3 pool the `lp-solver` named.
   - `strategy.type` in `defi-invest | lend | stake` → `executeYield()` → **Aave V3 `Pool.supply()`** when the token is a listed Aave reserve (USDT / USD₮0 today); otherwise falls back to OKX DEX routing.
9. **Agentic Wallet safety pipeline** fires for every tx: address validation → `eth_call` simulation → risk-grade (contract allowlist + amount limits) → send → wait for receipt → verify.
10. **Live event stream.** `flowx.event` messages flow back to the FE over Socket.IO (`/dashboard` namespace) at every stage.
11. **Result card** collapses into the same input area: winner, strategy, amount, tx hash with explorer link, and one line of plain English explaining what just happened on-chain.

---

## Architecture

```
User
 │ (RainbowKit wallet, EIP-3009 USDG signing)
 ▼
Next.js FE ─────────► /api/flow (x402 gated) ──► FlowX API (NestJS)
 ▲                                                │
 │                                                ▼
 │                                         Intent parser (Kimi / OpenRouter)
 │                                                │
 │                                                ▼
 │                                         Orchestrator
 │                                                │
 │                                    ┌───────────┼───────────┐
 │                                    ▼           ▼           ▼
 │                             lp-solver    yield-solver  risk-solver
 │                             (on-chain    (DefiLlama    (scoring
 │                              registry)   products)      only)
 │                                    │           │           │
 │                                    └──────┬────┴───────────┘
 │                                           ▼
 │                                  Orchestrator picks winner
 │                                           │
 │                                           ▼
 │                                 TradeService.executeStrategy
 │                                     ┌────┴────┐
 │                                     ▼         ▼
 │                              executeOnchain  executeYield
 │                              (OKX DEX V6)    (Aave V3 supply)
 │                                     │         │
 │                                     └────┬────┘
 │                                          ▼
 │                                 AgenticWalletService
 │                                 (validate → simulate →
 │                                  risk-grade → send → verify)
 │                                          │
 │                                          ▼
 │                                 X Layer mainnet tx
 │                                          │
 │                                          ▼
 └────── flowx.event (Socket.IO) ── Prisma (Postgres @ Supabase)
```

---

## Frontend pages

The FE is deliberately three pages — nothing more. Every surface either triggers the flow, reflects a position, or replays the live event stream.

### `/` — Deploy
The demo. A single textarea, a single **Deploy** button, and a result card that morphs in place through `parsing → competing → executing → done`. No modals, no tabs, no charts. The final state shows the winning solver, strategy + protocol pill, amount, short tx hash linked to the X Layer explorer, and a one-line explanation. The only header is the sticky `TopNav`.

### `/positions`
Your personal ledger. Renders a flat list of successful executions from `GET /api/execute/log`, one row per position — protocol, amount, projected APY, tx link. No detail modal, no rebalance/exit controls (backend doesn't expose those yet). When the wallet isn't connected we show a single-line empty state.

### `/activity`
Public firehose. Subscribes to the `/dashboard` Socket.IO namespace and prepends incoming `flowx.event` entries live. Seed data comes from `GET /api/events?limit=20` on first mount. Each entry is one line: relative time · solver · label · protocol · amount · tx hash. The three solvers are tagged with text pills (`DEX routing`, `Lending`, `Risk gate`) so judges can read the stream at a glance.

---

## Tech stack

| Layer             | Library                                     | Notes                                                                |
|-------------------|---------------------------------------------|----------------------------------------------------------------------|
| Framework         | **Next.js 15** (App Router)                 | All three routes prerendered as static                               |
| Language          | **TypeScript 5**                            | Strict                                                               |
| Styling           | **Tailwind CSS 3**                          | Monochrome palette, no design tokens beyond black/white/gray         |
| Wallet            | **RainbowKit 2** + **wagmi 3** + **viem 2** | `getDefaultConfig`, `xLayer` chain from `viem/chains`                |
| Data              | **@tanstack/react-query 5**                 | For `/execute/log`, `/events`, and the flow mutation                 |
| Live feed         | **socket.io-client 4**                      | Single socket on `/dashboard` namespace                              |
| x402 payment      | **@okxweb3/x402-core** + **@okxweb3/x402-evm** | EIP-3009 `TransferWithAuthorization` signing                      |
| Motion            | **framer-motion 11**                        | Modal transitions only                                               |
| Icons             | **lucide-react**                            | Used sparingly — tx link arrow, close, spinner                       |

State stays minimal: derive from backend responses, hydrate React Query, subscribe via socket for live deltas. Nothing persists client-side beyond wagmi's own wallet cache.

### Visual style

Black / white / gray only. No accent colors anywhere. `Inter` for UI, `JetBrains Mono` for addresses, tx hashes, solver names. Dividers are 1px `white/10`. The Deploy button and the x402 Approve button are the only solid-white surfaces in the app — intentional.

---

## Prerequisites

- **Node 20+**
- **pnpm 9+** (the repo uses a pnpm lockfile; `npm` works but isn't tested)
- The **FlowX API** running somewhere reachable — local default is `http://localhost:3001`. See [`be-flowX/flowx-api`](../be-flowX).
- A **WalletConnect / Reown project ID** — free, grab one from <https://cloud.reown.com>.
- A browser wallet on X Layer mainnet (`chainId 196`) with a tiny amount of USDG for the x402 fee.

---

## Getting started

```bash
pnpm install
cp .env.local.example .env.local   # if you haven't already
pnpm dev
```

Open <http://localhost:3000>. The FE proxies `/api/*` to the backend origin defined in `NEXT_PUBLIC_FLOWX_API_URL` (see `next.config.js`). The proxy exists on purpose: x402 sends a custom `PAYMENT-REQUIRED` response header, and browsers hide custom headers behind CORS unless the response is same-origin.

### Environment variables

All frontend env vars live in `.env.local` and must be prefixed `NEXT_PUBLIC_` so Next.js ships them to the client bundle.

```bash
# Where the FlowX API is running. Used both for SSR fetches and for the
# Next.js /api proxy rewrite in next.config.js.
NEXT_PUBLIC_FLOWX_API_URL=http://localhost:3001

# Socket.IO endpoint — must point at the backend's /dashboard namespace.
NEXT_PUBLIC_FLOWX_WS_URL=http://localhost:3001/dashboard

# Block explorer base URL used when rendering tx hashes.
NEXT_PUBLIC_XLAYER_EXPLORER=https://www.okx.com/web3/explorer/xlayer

# WalletConnect / Reown project id — free at https://cloud.reown.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

---

## Scripts

| Command               | What it does                                                               |
|-----------------------|----------------------------------------------------------------------------|
| `pnpm dev`            | Next.js dev server on `:3000` with hot reload                              |
| `pnpm build`          | Production build. All three routes are prerendered as static              |
| `pnpm start`          | Serve the production build                                                 |
| `pnpm lint`           | `next lint`                                                                |
| `pnpm api:types`      | Regenerate `lib/flowx-api.d.ts` from the backend OpenAPI spec (backend must be running at `localhost:3001/docs-json`) |

---

## Project layout

```
app/
  layout.tsx            # Root layout — Providers + TopNav
  providers.tsx         # Wagmi + RainbowKit + React Query + X402PaymentProvider
  globals.css           # Tailwind base + monochrome theme
  page.tsx              # / — Deploy: textarea, Deploy button, inline result card
  positions/page.tsx    # /positions — flat list from /api/execute/log
  activity/page.tsx     # /activity — live Socket.IO feed
components/
  TopNav.tsx            # Sticky header: FlowX · Deploy · Positions · Activity · ConnectButton
  x402/
    PaymentProvider.tsx # Wraps the app; exposes useX402Fetch()
    PaymentModal.tsx    # Minimal "Powered by x402" approval modal
lib/
  api.ts                # fetch wrappers + React Query hooks + Socket.IO feed hook
  format.ts             # USD / address / explorer URL helpers
  x402/
    fetch.ts            # x402Fetch — transparent 402 handler
    sign.ts             # EIP-712 typed data for TransferWithAuthorization
    types.ts            # PaymentRequired / PaymentRequirement / helpers
```

---

## How the x402 payment flow actually works

The FE never talks to x402 directly — it goes through `lib/x402/fetch.ts:x402Fetch()`, which wraps `fetch` and handles the `402 → sign → replay` dance transparently. `X402PaymentProvider` exposes it as a hook:

```ts
const x402Fetch = useX402Fetch();
const res = await x402Fetch('/api/flow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: intent }),
});
```

Under the hood:

1. First request fires normally.
2. If the backend responds `402 Payment Required` with a `PAYMENT-REQUIRED` header, `x402Fetch` decodes the payment requirements.
3. It calls the approver (`X402PaymentProvider`), which pops the minimal black-and-white **"Powered by x402"** modal.
4. On approve, the provider signs an **EIP-3009 `TransferWithAuthorization`** message on USDG using wagmi's `signTypedData`. It reads the on-chain token name via `publicClient.readContract` first, to avoid a domain-name mismatch between what x402 advertises and what USDG actually computes its `DOMAIN_SEPARATOR` with.
5. The signed payload is encoded into a `PAYMENT-SIGNATURE` header and the original request is replayed.
6. The OKX x402 facilitator settles the transfer gaslessly, the backend resolves the flow, and the result comes back as a normal JSON response.

No funds move from the user's wallet outside the 0.05 USDG fee. The actual on-chain DeFi tx (Aave supply, OKX DEX swap) is sent from the backend's Agentic Wallet, not from the user.

---

## Proven mainnet transactions

Real txs from earlier runs on X Layer mainnet — use these to verify the system is wired to production, not mocked:

- **Aave V3 `supply()` (yield-solver win)** — [`0xd28eb7da…afd30`](https://www.okx.com/web3/explorer/xlayer/tx/0xd28eb7da56e0fefb6ac6efe95740eb64958696b68eef68eb115672c9716afd30)
- **OKX DEX V6 `smartSwap` (lp-solver win)** — [`0xf443b6ae…1953`](https://www.okx.com/web3/explorer/xlayer/tx/0xf443b6ae6b7cc7dc6ebbf07c65d1a762fb71dce5cb69e650f68a502154d51953)

---

## Deploying

Any host that runs Next.js 15 works (Vercel, Railway, Fly, self-hosted Node).

- Set all four `NEXT_PUBLIC_*` env vars in the deploy environment.
- Point `NEXT_PUBLIC_FLOWX_API_URL` and `NEXT_PUBLIC_FLOWX_WS_URL` at your deployed backend.
- Make sure the backend allows the FE origin for both HTTP (the x402 header must be readable) and WebSocket (`withCredentials: true`).
- `pnpm build && pnpm start` — or let Vercel do it automatically.

The proxy rewrite in `next.config.js` works in both dev and production. Keep it in production too — it keeps `/api/*` same-origin and avoids the "CORS-hides-the-x402-header" footgun. If you decide to point the FE directly at the backend instead, make sure the backend exposes `PAYMENT-REQUIRED` via `Access-Control-Expose-Headers`.

---

## Troubleshooting

**"Connect Wallet" button doesn't appear.**
RainbowKit renders nothing during SSR; it hydrates client-side. `TopNav` renders a gray placeholder until a `useEffect` marks the component mounted, then swaps in the real `ConnectButton`. If you still see the placeholder after a full page load, check the browser console for a wagmi config error — usually a missing peer dependency or a bad `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

**App silently connects to the wrong wallet (e.g. Rabby instead of OKX).**
Multiple browser wallet extensions all patch `window.ethereum`, and wagmi by default auto-reconnects on mount. `app/providers.tsx` sets `<WagmiProvider reconnectOnMount={false}>` to force an explicit click every page load, so the user picks OKX (or whichever wallet) deliberately from the RainbowKit modal. RainbowKit uses that wallet's own EIP-6963 `rdns` — not `window.ethereum` — so the correct extension is targeted.

**x402 modal stuck on "Signing…".**
Your wallet is probably prompting on a chain that isn't X Layer. The provider switches chain automatically via `useSwitchChain` before signing — approve the chain-switch prompt first, then the typed-data prompt.

**Socket.IO shows "offline" on `/activity`.**
Check `NEXT_PUBLIC_FLOWX_WS_URL`. It must point at the backend's `/dashboard` namespace, not the root. The backend must also allow `withCredentials` from the FE origin.

---

## License

Hackathon submission — no license declared. Open an issue if you want to reuse the code.

---

## Credits

Built for **OKX Build X 2026 — X Layer Arena** by the FlowX team.

Powered by OKX Onchain OS: Agentic Wallet · DEX V6 aggregator · x402 Payments · Onchain Gateway. AI intent parser: Moonshot Kimi via OpenRouter. Yield data: DefiLlama. Lending rail: Aave V3 on X Layer.
