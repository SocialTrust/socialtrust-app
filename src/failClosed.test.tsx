// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'

const wallet = '0x0000000000000000000000000000000000000001' as Address

// Flipped per test: a broken deployment must fail closed whether or not a real
// wallet happens to be connected.
const walletState = vi.hoisted(() => ({
  address: undefined as Address | undefined,
  isConnected: false,
}))

const readContract = vi.fn(async () => 0n)
const waitForTransactionReceipt = vi.fn()
const getBlockNumber = vi.fn(async () => 200n)
const writeContract = vi.fn()
const openConnectModal = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({ readContract, waitForTransactionReceipt, getBlockNumber }),
  }
})

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: walletState.address, isConnected: walletState.isConnected, chainId: 31337 }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(async () => undefined) }),
  useWalletClient: () => ({
    data: walletState.isConnected ? { getChainId: async () => 31337, writeContract } : undefined,
  }),
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal }),
}))

const MISSING = [
  { variable: 'VITE_SOCIALTRUST_ADDRESS', message: 'Set VITE_SOCIALTRUST_ADDRESS to the deployed SocialTrust contract address.' },
  { variable: 'VITE_CHAIN_ID', message: 'Set VITE_CHAIN_ID to the numeric id of the target chain.' },
]

// The state that used to switch the app into mock mode: no contract address,
// zero addresses everywhere, no chain id.
vi.mock('./lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/config')>()
  const zero = '0x0000000000000000000000000000000000000000' as Address
  return {
    ...actual,
    configProblems: MISSING,
    isConfigured: false,
    appConfig: {
      ...actual.appConfig,
      contractAddress: zero,
      usdcAddress: zero,
      profilesAddress: zero,
      chainId: Number.NaN,
      isConfigured: false,
      configProblems: MISSING,
      hasProfiles: false,
      graphEnabled: false,
      graphUrl: '',
    },
  }
})

const { default: App } = await import('./App')
const { useSocialTrust } = await import('./hooks/useSocialTrust')

beforeEach(() => {
  walletState.address = undefined
  walletState.isConnected = false
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
})

afterEach(cleanup)

/** Renders the hook and lets any effect it schedules settle. */
async function renderSettledHook() {
  const view = renderHook(() => useSocialTrust())
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
  return view
}

describe('missing core configuration shows the configuration error', () => {
  it('names every environment variable that must be set', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Configuration required' })).toBeTruthy()
    for (const problem of MISSING) {
      expect(screen.getByText(problem.variable)).toBeTruthy()
      expect(screen.getByText(problem.message)).toBeTruthy()
    }
  })

  it('offers no wallet entry point and no app shell to browse', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull()
    expect(document.querySelector('nav.bottomNav')).toBeNull()
    // No fabricated balances, friends or activity behind the error either.
    expect(screen.queryByText(/USDC/)).toBeNull()
  })

  it('shows the error even when a wallet is already connected', () => {
    walletState.address = wallet
    walletState.isConnected = true

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Configuration required' })).toBeTruthy()
    expect(document.querySelector('nav.bottomNav')).toBeNull()
  })
})

describe('no mock snapshot or mock account is exposed', () => {
  it('exposes no account and no data while disconnected', async () => {
    const { result } = await renderSettledHook()

    expect(result.current.isConfigured).toBe(false)
    expect(result.current.configProblems).toEqual(MISSING)
    expect(result.current.account).toBeUndefined()
    expect(result.current.connectedWallet).toBeUndefined()
    expect(result.current.isConnected).toBe(false)
    expect(result.current.snapshot).toBeUndefined()
    expect(result.current.config).toBeUndefined()
    expect(result.current.isOwner).toBe(false)
  })

  it('reads nothing from the chain, so nothing can be invented from a default', async () => {
    walletState.address = wallet
    walletState.isConnected = true

    const { result } = await renderSettledHook()

    expect(readContract).not.toHaveBeenCalled()
    // The real connected address is reported truthfully; the data behind it is not.
    expect(result.current.account).toBe(wallet)
    expect(result.current.snapshot).toBeUndefined()
    expect(result.current.config).toBeUndefined()
  })
})

describe('actions cannot report simulated success or reach a wallet', () => {
  const cases: Array<[string, (actions: ReturnType<typeof useSocialTrust>['actions']) => Promise<boolean>]> = [
    ['approveUsdc', (actions) => actions.approveUsdc()],
    ['deposit', (actions) => actions.deposit('10')],
    ['withdraw', (actions) => actions.withdraw('10')],
    ['stakeForFriendship', (actions) => actions.stakeForFriendship(wallet)],
    ['depositAndStakeForFriendship', (actions) => actions.depositAndStakeForFriendship(wallet, '10')],
    ['cancelPendingStake', (actions) => actions.cancelPendingStake(wallet)],
    ['rejectPendingStake', (actions) => actions.rejectPendingStake(wallet)],
    ['steal', (actions) => actions.steal(wallet)],
    ['finalizeFriendship', (actions) => actions.finalizeFriendship(wallet)],
    ['matchMe', (actions) => actions.matchMe()],
    ['depositAndMatchMe', (actions) => actions.depositAndMatchMe('10')],
    ['cancelMatchMe', (actions) => actions.cancelMatchMe()],
    ['cleanupMyExpiredMatch', (actions) => actions.cleanupMyExpiredMatch()],
    ['setScore', (actions) => actions.setScore(wallet, '5')],
  ]

  it.each(cases)('refuses %s with a configuration error instead of success', async (_name, run) => {
    walletState.address = wallet
    walletState.isConnected = true
    const { result } = await renderSettledHook()

    let outcome: boolean | undefined
    await act(async () => { outcome = await run(result.current.actions) })

    expect(outcome).toBe(false)
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.pending).toBe(false)
    expect(result.current.tx.success).toBeUndefined()
    expect(result.current.tx.error).toContain('not configured')
    for (const problem of MISSING) {
      expect(result.current.tx.error).toContain(problem.variable)
    }
    // Nothing was refreshed off the back of a "successful" write.
    expect(readContract).not.toHaveBeenCalled()
  })

  it('refuses to open the wallet connection modal', async () => {
    const { result } = await renderSettledHook()

    act(() => { result.current.connect() })

    expect(openConnectModal).not.toHaveBeenCalled()
    expect(result.current.tx.error).toContain('VITE_SOCIALTRUST_ADDRESS')
  })

  it('never reports a wrong network, which would imply a usable chain', async () => {
    walletState.address = wallet
    walletState.isConnected = true

    const { result } = await renderSettledHook()

    expect(result.current.wrongNetwork).toBe(false)
  })

  it('refuses a manual refresh instead of loading placeholder data', async () => {
    walletState.address = wallet
    walletState.isConnected = true
    const { result } = await renderSettledHook()

    await act(async () => { await result.current.refresh() })

    expect(readContract).not.toHaveBeenCalled()
    expect(result.current.snapshot).toBeUndefined()
  })
})

describe('production sources carry no mock mode', () => {
  it('has no runtime mock module, flag or switch left to activate', () => {
    const sources = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

    const offenders = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => /isMockMode|VITE_USE_MOCKS|\/mock'/.test(source))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
