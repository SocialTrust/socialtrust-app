import type { Address, Chain } from 'viem'
import { defineChain } from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'
import { ZERO_ADDRESS } from './format'

const envContract = import.meta.env.VITE_SOCIALTRUST_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS || ZERO_ADDRESS
const contractAddress = envContract as Address
const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || ZERO_ADDRESS) as Address
const profilesAddress = (import.meta.env.VITE_PROFILES_ADDRESS || ZERO_ADDRESS) as Address
const rpcUrl = import.meta.env.VITE_RPC_URL || ''
const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31337)
const chainName = import.meta.env.VITE_CHAIN_NAME || 'Localhost'
const mockFlag = String(import.meta.env.VITE_USE_MOCKS || '').toLowerCase()
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''
const graphUrl = String(import.meta.env.VITE_GRAPH_URL || import.meta.env.VITE_GRAPH_ACTIVITY_URL || '').trim()
const graphFlag = String(import.meta.env.VITE_GRAPH_ENABLED || import.meta.env.VITE_GRAPH_ACTIVITY_ENABLED || '').toLowerCase()
const paymasterUrl = String(import.meta.env.VITE_PAYMASTER_URL || '').trim()
const batchFlag = String(import.meta.env.VITE_BATCH_CALLS || 'true').toLowerCase()

const appUrl = (import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')

// Single source of truth for the chain.
//
// Prefer viem's canonical definition when the configured id is a known chain.
// Mobile wallets match a chain by id against their own registry: handing them a
// hand-rolled definition makes some of them prompt to *add* an unknown network
// instead of simply switching, which is a common cause of "switch network does
// nothing" on phones. Our own RPC is still used for reads via transports.
const knownChains: Chain[] = [baseSepolia, base, sepolia, mainnet]

function resolveChain(): Chain {
  const known = knownChains.find((chain) => chain.id === chainId)
  if (known) return known

  return defineChain({
    id: chainId,
    name: chainName,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl || 'http://127.0.0.1:8545'] } },
  })
}

export const appChain = resolveChain()

export const appConfig = {
  contractAddress,
  usdcAddress,
  profilesAddress,
  rpcUrl,
  chainId,
  chainName: appChain.name || chainName,
  isMockMode: mockFlag === 'true' || contractAddress.toLowerCase() === ZERO_ADDRESS,
  hasProfiles: profilesAddress.toLowerCase() !== ZERO_ADDRESS,
  walletConnectProjectId,
  graphUrl,
  graphEnabled: graphFlag === 'true' && graphUrl.length > 0,
  appUrl,
  paymasterUrl,
  // EIP-5792 batching collapses approve + deposit into a single confirmation on
  // smart accounts. Disable to force the legacy sequential path.
  batchCalls: batchFlag !== 'false',
}

// Kept for callers that still import the old name.
export const configuredChain = appChain
