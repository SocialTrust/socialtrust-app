// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { SocialProfile } from '../types'

const account = '0x0000000000000000000000000000000000000001' as Address
const contractAddress = '0x00000000000000000000000000000000000000bb' as Address
const profilesAddress = '0x00000000000000000000000000000000000000aa' as Address

type ReadCall = { address: Address; functionName: string; blockNumber?: bigint }

const readContract = vi.fn<(params: ReadCall) => Promise<unknown>>()
const waitForTransactionReceipt = vi.fn()
const getBlockNumber = vi.fn(async () => 200n)
const writeContract = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({ readContract, waitForTransactionReceipt, getBlockNumber }),
  }
})

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: account, isConnected: true, chainId: 31337 }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(async () => undefined) }),
  useWalletClient: () => ({ data: { getChainId: async () => 31337, writeContract } }),
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
}))

vi.mock('../lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/config')>()
  return {
    ...actual,
    appConfig: {
      ...actual.appConfig,
      contractAddress,
      profilesAddress,
      chainId: 31337,
      isConfigured: true,
      configProblems: [],
      hasProfiles: true,
      graphEnabled: false,
      graphUrl: '',
    },
  }
})

const { useSocialTrust } = await import('./useSocialTrust')

const savedProfile: SocialProfile = {
  displayName: 'Jamie',
  xUsername: 'old_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: 'https://pbs.twimg.com/profile_images/1/a.jpg',
  exists: true,
}

const updatedProfile: SocialProfile = {
  ...savedProfile,
  displayName: 'Jamie Updated',
  xUsername: 'new_x',
}

// The on-chain profile the mocked RPC serves. Flipped to the updated value once
// the write is broadcast, exactly like a confirmed transaction would.
let onChainProfile: SocialProfile = savedProfile
let calls: ReadCall[] = []

const coreStateReads = ['balances', 'repScore', 'pendingBonus', 'bonusPaidTo', 'allowance', 'balanceOf']

function profileReads() {
  return calls.filter((call) => call.functionName === 'getProfile')
}

beforeEach(() => {
  calls = []
  onChainProfile = savedProfile
  vi.clearAllMocks()
  getBlockNumber.mockImplementation(async () => 200n)
  writeContract.mockResolvedValue('0xhash')
  waitForTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 123n })
  readContract.mockImplementation(async (params: ReadCall) => {
    calls.push({ address: params.address, functionName: params.functionName, blockNumber: params.blockNumber })
    if (params.address === profilesAddress) {
      if (params.functionName === 'getProfiles') return []
      return onChainProfile
    }
    if (params.functionName === 'owner') return account
    if (params.functionName === 'isInMatchQueue') return false
    if (params.functionName === 'areFriends') return false
    return 0n
  })
})

afterEach(cleanup)

async function renderLoadedHook() {
  const view = renderHook(() => useSocialTrust())
  await waitFor(() => expect(view.result.current.snapshot?.socialProfile).toEqual(savedProfile))
  calls = []
  return view
}

const editedValues = {
  displayName: 'Jamie Updated',
  xUsername: 'new_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: 'https://pbs.twimg.com/profile_images/1/a.jpg',
}

describe('useSocialTrust setProfile refresh', () => {
  it('reads the profile back at the receipt block and updates snapshot.socialProfile', async () => {
    const { result } = await renderLoadedHook()
    writeContract.mockImplementation(async () => {
      onChainProfile = updatedProfile
      return '0xhash'
    })

    let saved: unknown
    await act(async () => {
      saved = await result.current.actions.setProfile(editedValues)
    })

    expect(saved).toBe(true)
    expect(waitForTransactionReceipt).toHaveBeenCalledOnce()
    // Exactly one profile read, pinned to the confirmed receipt block.
    expect(profileReads()).toEqual([
      { address: profilesAddress, functionName: 'getProfile', blockNumber: 123n },
    ])
    expect(result.current.snapshot?.socialProfile).toEqual(updatedProfile)
  })

  it('does not refetch balances, reputation, allowance, or Graph data for a profile edit', async () => {
    const { result } = await renderLoadedHook()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await act(async () => {
      await result.current.actions.setProfile(editedValues)
    })
    // Let any detached follow-up work that a non-profile write would schedule run.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })

    expect(calls.filter((call) => coreStateReads.includes(call.functionName))).toEqual([])
    expect(calls.filter((call) => call.functionName === 'stakeAmt')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(profileReads()).toHaveLength(1)
    fetchSpy.mockRestore()
  })

  it('does not refresh the profile when the transaction fails', async () => {
    const { result } = await renderLoadedHook()
    writeContract.mockRejectedValue(new Error('User rejected the request.'))

    let saved: unknown
    await act(async () => {
      saved = await result.current.actions.setProfile(editedValues)
    })

    expect(saved).toBe(false)
    expect(waitForTransactionReceipt).not.toHaveBeenCalled()
    // No receipt-pinned profile read: nothing was confirmed to refresh from.
    expect(profileReads().filter((call) => call.blockNumber !== undefined)).toEqual([])
    expect(result.current.snapshot?.socialProfile).toEqual(savedProfile)
    expect(result.current.tx.error).toBe('You rejected the request in your wallet.')
  })
})
