// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import socialTrustAbi from '../contracts/abis/SocialTrust.json'

const account = '0x0000000000000000000000000000000000000001' as Address
const other = '0x0000000000000000000000000000000000000002' as Address
const contractAddress = '0x00000000000000000000000000000000000000bb' as Address
const profilesAddress = '0x00000000000000000000000000000000000000aa' as Address
const pairKey = '0x00000000000000000000000000000000000000000000000000000000000000ab'

type ReadCall = { address: Address; functionName: string; args?: readonly unknown[]; blockNumber?: bigint }

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
      hasProfiles: false,
      graphEnabled: false,
      graphUrl: '',
    },
  }
})

const { useSocialTrust } = await import('./useSocialTrust')

const STAKE = 25_000_000n
const DURATION = 2_000n
const GRACE = 1_000n

/**
 * The tuple shape of the public pairChallenges(bytes32) getter, in ABI order:
 * account0, account1, stakeAmount, cancelPendingStakeFee, rejectPendingStakeFee,
 * challengeDuration, stealGracePeriod, stealBounty, friendshipSuccessFee,
 * staked0, staked1, challengeStartedAt.
 */
function pairChallengeTuple(opts: { staked0: boolean; staked1: boolean; startedAt: bigint }) {
  return [
    account, other,
    STAKE, 1_000_000n, 1_000_000n,
    DURATION, GRACE, 35_000_000n, 0n,
    opts.staked0, opts.staked1, opts.startedAt,
  ]
}

/** What the getter returns for a pair that never existed, or was deleted. */
const EMPTY_PAIR = [
  '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000',
  0n, 0n, 0n, 0n, 0n, 0n, 0n, false, false, 0n,
]

let pairChallengeResult: unknown = EMPTY_PAIR
let calls: ReadCall[] = []

beforeEach(() => {
  calls = []
  pairChallengeResult = EMPTY_PAIR
  vi.clearAllMocks()
  getBlockNumber.mockImplementation(async () => 200n)
  writeContract.mockResolvedValue('0xhash')
  waitForTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 123n })

  readContract.mockImplementation(async (params: ReadCall) => {
    calls.push({ address: params.address, functionName: params.functionName, args: params.args })
    // viem rejects a call to a function the ABI does not declare, which is what
    // the deployed contract did for getChallengeView. Reproduce that here so a
    // call to a non-existent function fails the test instead of silently
    // returning a default.
    if (
      params.address === contractAddress &&
      !(socialTrustAbi as { name?: string }[]).some((entry) => entry.name === params.functionName)
    ) {
      throw new Error(`AbiFunctionNotFoundError: "${params.functionName}" is not in the ABI.`)
    }
    if (params.functionName === 'pairKey') return pairKey
    if (params.functionName === 'pairChallenges') return pairChallengeResult
    if (params.functionName === 'owner') return account
    if (params.functionName === 'isInMatchQueue') return false
    if (params.functionName === 'activeMatchIdOf') return 0n
    if (params.functionName === 'challengeDuration') return DURATION
    if (params.functionName === 'stealGracePeriod') return GRACE
    if (params.functionName === 'stakeAmt') return STAKE
    return 0n
  })
})

afterEach(cleanup)

async function renderLoadedHook() {
  const view = renderHook(() => useSocialTrust())
  await waitFor(() => expect(view.result.current.snapshot).toBeDefined())
  calls = []
  return view
}

/** Runs the action and lets the detached post-write refresh finish. */
async function runAction(run: () => Promise<unknown>) {
  await act(async () => { await run() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
}

const challengeReads = () => calls.filter((call) => call.functionName === 'pairKey' || call.functionName === 'pairChallenges')

describe('targeted challenge verification', () => {
  it('reads the pair key and the public pairChallenges getter', async () => {
    pairChallengeResult = pairChallengeTuple({ staked0: true, staked1: false, startedAt: 0n })
    const { result } = await renderLoadedHook()

    await runAction(() => result.current.actions.stakeForFriendship(other))

    expect(challengeReads().map((call) => call.functionName)).toEqual(['pairKey', 'pairChallenges'])
    expect(challengeReads()[0].args).toEqual([account, other])
    expect(challengeReads()[1].args).toEqual([pairKey])
  })

  it('never calls a getChallengeView function, which the contract does not have', async () => {
    pairChallengeResult = pairChallengeTuple({ staked0: true, staked1: false, startedAt: 0n })
    const { result } = await renderLoadedHook()

    await runAction(() => result.current.actions.stakeForFriendship(other))

    expect(calls.some((call) => call.functionName === 'getChallengeView')).toBe(false)
    // And it must not be smuggled into the ABI to make such a call possible.
    expect((socialTrustAbi as { name?: string }[]).some((entry) => entry.name === 'getChallengeView')).toBe(false)
    expect((socialTrustAbi as { name?: string }[]).some((entry) => entry.name === 'pairChallenges')).toBe(true)
  })

  it('normalizes a pending challenge, with only the user staked', async () => {
    pairChallengeResult = pairChallengeTuple({ staked0: true, staked1: false, startedAt: 0n })
    const { result } = await renderLoadedHook()

    await runAction(() => result.current.actions.stakeForFriendship(other))

    const challenge = result.current.snapshot?.challenges.find((entry) => entry.other === other)
    expect(challenge).toBeDefined()
    expect(challenge).toMatchObject({
      pairKey,
      account0: account,
      account1: other,
      other,
      stakeAmount: STAKE,
      userStaked: true,
      otherStaked: false,
      active: false,
      challengeStartedAt: 0n,
      // A pending challenge has no timer yet.
      stealAllowedAt: 0n,
      challengeEndsAt: 0n,
    })
  })

  it('normalizes an active challenge, deriving the steal and finalize times', async () => {
    const startedAt = BigInt(Math.floor(Date.now() / 1000)) - 10n
    pairChallengeResult = pairChallengeTuple({ staked0: true, staked1: true, startedAt })
    const { result } = await renderLoadedHook()

    await runAction(() => result.current.actions.stakeForFriendship(other))

    const challenge = result.current.snapshot?.challenges.find((entry) => entry.other === other)
    expect(challenge).toMatchObject({
      userStaked: true,
      otherStaked: true,
      active: true,
      challengeStartedAt: startedAt,
      stealAllowedAt: startedAt + GRACE,
      challengeEndsAt: startedAt + DURATION,
    })
  })

  it('adds nothing for a pair that has no challenge', async () => {
    pairChallengeResult = EMPTY_PAIR
    const { result } = await renderLoadedHook()

    await runAction(() => result.current.actions.stakeForFriendship(other))

    // The read still happened; it simply produced no challenge.
    expect(challengeReads().map((call) => call.functionName)).toEqual(['pairKey', 'pairChallenges'])
    expect(result.current.snapshot?.challenges).toEqual([])
  })

  it('drops a completed challenge once the contract has deleted it', async () => {
    pairChallengeResult = pairChallengeTuple({ staked0: true, staked1: true, startedAt: 10n })
    const { result } = await renderLoadedHook()

    await runAction(() => result.current.actions.stakeForFriendship(other))
    expect(result.current.snapshot?.challenges).toHaveLength(1)

    // finalizeFriendship deletes the pair, so the getter now returns zeros.
    pairChallengeResult = EMPTY_PAIR
    await runAction(() => result.current.actions.finalizeFriendship(other))

    expect(result.current.snapshot?.challenges).toEqual([])
  })
})
