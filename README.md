# SocialTrust v47 Frontend

v47 is based on the stable v45 transaction flow and changes only the wallet-connection configuration plus build reproducibility/safety cleanups.

## v47 wallet connection design

RainbowKit remains responsible for opening the connection modal and connecting/deep-linking wallets. Wagmi `useAccount()` remains the source of truth for connected account state, and the existing v45 transaction code continues to use the wallet client from the established session. Transaction actions do not attempt to reconnect the wallet.

The wallet list is now explicit and ordered:

1. MetaMask
2. Rabby
3. WalletConnect fallback
4. Injected-wallet fallback

This keeps first-class MetaMask and Rabby entries while retaining generic fallbacks for other WalletConnect and browser-extension wallets.

The old `VITE_APP_URL` setting has been removed because it was not consumed by the v45 RainbowKit/wagmi configuration and did not control mobile redirects.

## Pinned wallet stack

To stop fresh installs from silently changing the core connection stack, v47 pins:

- `@rainbow-me/rainbowkit`: `2.2.11`
- `wagmi`: `3.7.1`
- `viem`: `2.55.2`

## Base Sepolia deployment

```bash
VITE_SOCIALTRUST_ADDRESS=0xa0A4a7D6c8d06EcaA084384363D95D77eadF4497
VITE_CONTRACT_ADDRESS=0xa0A4a7D6c8d06EcaA084384363D95D77eadF4497
VITE_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
VITE_PROFILES_ADDRESS=0xC0C80f89d32A1b92D893881bCF48779F06BcAa70
VITE_CHAIN_ID=84532
VITE_CHAIN_NAME=Base Sepolia
VITE_DEPLOYMENT_BLOCK=44297620
VITE_GRAPH_ENABLED=true
VITE_GRAPH_URL=https://api.studio.thegraph.com/query/1756570/socialtrust-base-sepolia/0.1.0
```

Add your own client-side values for:

```bash
VITE_RPC_URL=...
VITE_WALLETCONNECT_PROJECT_ID=...
```

For production hosting, add the same variables in Vercel Project Settings and redeploy. `VITE_` variables are included in the browser bundle, so restrict RPC/WalletConnect credentials by domain/origin where their providers support it. Never place wallet private keys or seed phrases in frontend environment variables.

## Local setup

```bash
cd ~/socialtrust

rm -rf socialtrust-v47-frontend
unzip ~/Downloads/socialtrust-v47-frontend.zip
cd socialtrust-v47-frontend

npm install
cp .env.example .env.local
# Fill in VITE_RPC_URL and VITE_WALLETCONNECT_PROJECT_ID in .env.local
npm run dev -- --host 0.0.0.0
```

## Data architecture

The Graph supplies:

- current pending/active challenges via `challengeParticipants`
- finalized friends via `friendships`
- recent activity via `activities`

Direct contract reads remain authoritative for:

- internal app balance
- wallet USDC balance / allowance
- reputation score
- pending bonus and bonus accounting
- admin/config parameters
- `areFriends`
- `pairKey` + `getChallengeView` for targeted post-transaction verification
- all write transactions

## Preserved v45 behavior

- Keeps the v45 transaction/session logic rather than the v46 reconnect-at-write experiment.
- Keeps the stale-balance overwrite fix and delayed authoritative RPC balance rechecks.
- Keeps missing-amount deposit logic for `Deposit & stake`.
- Keeps targeted pair verification and The Graph transaction-hash polling.
- Keeps the profile dropdown close button, outside-click closing, Escape closing, and `✓ Copied` feedback.
- Includes the profile callback TypeScript compatibility fix required by production `tsc -b` builds.

---

## v48 — PWA + passkey smart wallet

### What changed

| Area | Change |
| --- | --- |
| `src/wagmi.ts` | Coinbase Smart Wallet listed first (passkey, no app install); grouped wallet lists (RainbowKit expects `[{ groupName, wallets }]`, not a flat array); WalletConnect app metadata added |
| `src/lib/config.ts` | Single chain source of truth using viem's canonical `baseSepolia`; adds `appUrl` and `paymasterUrl` |
| `src/hooks/useSocialTrust.ts` | Sequential transaction flow; chain-switch now polls instead of checking once after 500 ms |
| `index.html` | Installable PWA metadata, `viewport-fit=cover`, apple touch icons |
| `public/` | `manifest.webmanifest`, `sw.js`, generated icon set |
| `src/main.tsx` | Service worker registration (production only) |
| `src/styles.css` | Safe-area insets, 44px touch targets, 16px inputs (stops iOS zoom-on-focus) |

### The mobile flow this produces

First-time user, no wallet, mobile Safari:

1. Taps invite link, taps **Stake for friendship**.
2. RainbowKit sheet → **Coinbase Wallet** → popup → **Face ID** → passkey smart account created. No install, no seed phrase, no app switch.
3. Needs USDC on Base (the remaining real onboarding wall).
4. Taps stake. If the USDC allowance is sufficient, the stake needs one wallet confirmation. If allowance is insufficient, the app requests an exact-amount USDC approval, waits for it to confirm, and then requests the stake transaction, for two consecutive wallet confirmations from the original app action. With `VITE_PAYMASTER_URL` set, sponsored smart-account transactions may not require ETH.

Returning user: silent reconnect, allowance already set, one Face ID, done.

### Before deploying

- Passkeys are **origin-bound**. A smart account created on a preview URL is a different account from one created on production. Set `VITE_APP_URL` and keep the production origin stable.
- The connect call must stay inside an `onClick` handler. iOS Safari blocks popups that are not triggered by a direct user gesture — never call it from `useEffect`.
- The service worker caches the app shell only, never RPC or The Graph responses. Stale balances would be worse than a spinner.
- If you configure a paymaster, restrict the sponsorship policy to your contract and USDC, and cap per-user spend.

### Verify before shipping

`npm install && npm run build` was **not** run on this machine (no network access), so treat the TypeScript build as unverified. In particular, confirm that `@rainbow-me/rainbowkit@2.2.11` is compatible with `wagmi@3.7.1` — RainbowKit 2.x declared a peer dependency on wagmi 2.x, and a peer mismatch here shows up as subtly broken connect behaviour. Pin `react`, `vite`, and `typescript` (currently `latest`) before mainnet.
