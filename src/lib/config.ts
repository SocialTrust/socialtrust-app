import type { Address, Chain } from 'viem'
import { defineChain } from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'
import { ZERO_ADDRESS } from './format'

const envContract = import.meta.env.VITE_SOCIALTRUST_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS || ZERO_ADDRESS
const contractAddress = envContract as Address
const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || ZERO_ADDRESS) as Address
const profilesAddress = (import.meta.env.VITE_PROFILES_ADDRESS || ZERO_ADDRESS) as Address
const rpcUrl = import.meta.env.VITE_RPC_URL || ''
const rawChainId = String(import.meta.env.VITE_CHAIN_ID ?? '').trim()
const chainId = Number(rawChainId)
const chainName = import.meta.env.VITE_CHAIN_NAME || 'Localhost'
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''
const graphUrl = String(import.meta.env.VITE_GRAPH_URL || import.meta.env.VITE_GRAPH_ACTIVITY_URL || '').trim()
const graphFlag = String(import.meta.env.VITE_GRAPH_ENABLED || import.meta.env.VITE_GRAPH_ACTIVITY_ENABLED || '').toLowerCase()
const paymasterUrl = String(import.meta.env.VITE_PAYMASTER_URL || '').trim()

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

  // A chain object has to exist for the wagmi config to be constructed at
  // module load. When the id is missing or invalid this placeholder keeps
  // construction from throwing; `configProblems` below reports the fault and
  // the app refuses to run rather than quietly talking to the wrong chain.
  return defineChain({
    id: Number.isInteger(chainId) && chainId > 0 ? chainId : 31337,
    name: chainName,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl || 'http://127.0.0.1:8545'] } },
  })
}

export const appChain = resolveChain()

/** One thing the deployment has to fix before the app can be used. */
export type ConfigProblem = {
  /** The environment variable to set. */
  variable: string
  /** What is wrong with it, in words a deployer can act on. */
  message: string
}

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

function addressProblem(variable: string, value: string | undefined, purpose: string): ConfigProblem | undefined {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed.toLowerCase() === ZERO_ADDRESS) {
    return { variable, message: `Set ${variable} to ${purpose}.` }
  }
  if (!ADDRESS_PATTERN.test(trimmed)) {
    return { variable, message: `${variable} is not a valid 0x address.` }
  }
  return undefined
}

export type ConfigInput = {
  contractAddress?: string
  usdcAddress?: string
  /** The raw VITE_CHAIN_ID string, so "" and "abc" are distinguishable. */
  rawChainId?: string
}

/**
 * Pure so the rules can be tested without rebuilding the module against a
 * different environment.
 */
export function collectConfigProblems(input: ConfigInput): ConfigProblem[] {
  const rawChain = (input.rawChainId ?? '').trim()
  const chain = Number(rawChain)

  return [
    addressProblem('VITE_SOCIALTRUST_ADDRESS', input.contractAddress, 'the deployed SocialTrust contract address'),
    addressProblem('VITE_USDC_ADDRESS', input.usdcAddress, 'the USDC token address for this chain'),
    !rawChain
      ? { variable: 'VITE_CHAIN_ID', message: 'Set VITE_CHAIN_ID to the numeric id of the target chain.' }
      : !Number.isInteger(chain) || chain <= 0
        ? { variable: 'VITE_CHAIN_ID', message: `VITE_CHAIN_ID must be a positive whole number, not "${rawChain}".` }
        : undefined,
  ].filter((problem): problem is ConfigProblem => problem !== undefined)
}

/**
 * Configuration the app cannot function without.
 *
 * There is deliberately no fallback. A missing contract address used to switch
 * the whole app into a mock mode that fabricated a connected wallet, balances,
 * friends and successful transactions — which looks like a working deployment
 * and is far more dangerous than an error screen. Now it fails closed: these
 * problems are surfaced to the user and every wallet action stays disabled.
 *
 * VITE_PROFILES_ADDRESS is not included. Profiles are genuinely optional; the
 * app degrades to addresses without them, and the profile editor already says
 * so.
 */
export const configProblems: ConfigProblem[] = collectConfigProblems({
  contractAddress,
  usdcAddress,
  rawChainId,
})

export const isConfigured = configProblems.length === 0

export const appConfig = {
  contractAddress,
  usdcAddress,
  profilesAddress,
  rpcUrl,
  chainId,
  chainName: appChain.name || chainName,
  configProblems,
  isConfigured,
  hasProfiles: profilesAddress.toLowerCase() !== ZERO_ADDRESS,
  walletConnectProjectId,
  graphUrl,
  graphEnabled: graphFlag === 'true' && graphUrl.length > 0,
  appUrl,
  paymasterUrl,
}

// Kept for callers that still import the old name.
export const configuredChain = appChain

// Block explorer links come from the configured chain itself, so a chain change
// moves the links with it and an unknown chain simply renders no link at all.
export const explorerBaseUrl = (appChain.blockExplorers?.default?.url ?? '').replace(/\/$/, '')

export function transactionUrl(hash?: string) {
  if (!hash || !explorerBaseUrl) return undefined
  return `${explorerBaseUrl}/tx/${hash}`
}
