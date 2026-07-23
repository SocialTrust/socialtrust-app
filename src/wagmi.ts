import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { http } from 'wagmi'
import { appChain } from './lib/config'
import { appConfig } from './lib/config'

export { appChain }

// v48: Coinbase Smart Wallet first.
//
// On mobile there is no extension, so a connect flow that assumes an injected
// provider finds nothing. Coinbase Smart Wallet creates a passkey-controlled
// smart account inside the browser (Face ID / fingerprint, no app install, no
// seed phrase), which is the only option here that works for a friend who
// arrives from an invite link with no wallet at all.
//
// Everything below it is for people who already own a wallet. RainbowKit owns
// connection and deep-linking; transaction code uses the connected wagmi wallet
// client and never initiates a reconnect.
export const wagmiConfig = getDefaultConfig({
  appName: 'SocialTrust',
  appDescription: 'Stake USDC with a friend and prove the friendship.',
  appUrl: appConfig.appUrl,
  appIcon: `${appConfig.appUrl}/icons/icon-192.png`,

  projectId: appConfig.walletConnectProjectId,

  wallets: [
    {
      groupName: 'No wallet needed',
      wallets: [coinbaseWallet],
    },
    {
      groupName: 'Existing wallet',
      wallets: [
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
    {
      groupName: 'Desktop',
      wallets: [rabbyWallet],
    },
  ],

  chains: [appChain],

  transports: {
    [appChain.id]: http(appConfig.rpcUrl || undefined),
  },
})
