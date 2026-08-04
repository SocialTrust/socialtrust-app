// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'

const account = '0x0000000000000000000000000000000000000001' as Address
const other = '0x0000000000000000000000000000000000000002' as Address
const contractAddress = '0x00000000000000000000000000000000000000bb' as Address
const profilesAddress = '0x00000000000000000000000000000000000000aa' as Address
const usdcAddress = '0x00000000000000000000000000000000000000cc' as Address

const readContract = vi.fn()
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
      usdcAddress,
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

/** Inputs that must never reach a contract call. */
const REJECTED_AMOUNTS: [string, string][] = [
  ['empty input', ''],
  ['whitespace only', '   '],
  ['exponent notation', '1e3'],
  ['Infinity', 'Infinity'],
  ['NaN', 'NaN'],
  ['a negative value', '-5'],
  ['an explicit plus sign', '+5'],
  ['more than six decimals', '1.1234567'],
  ['a trailing decimal point', '5.'],
  ['a leading decimal point', '.5'],
  ['two decimal points', '1.2.3'],
  ['a thousands separator', '1,234.50'],
  ['letters', 'abc'],
  ['a currency symbol', '$10'],
]

const REJECTED_INTEGERS: [string, string][] = [
  ['empty input', ''],
  ['a decimal', '12.5'],
  ['a negative value', '-1'],
  ['exponent notation', '1e3'],
  ['Infinity', 'Infinity'],
  ['a unit suffix', '120s'],
  ['a thousands separator', '1,000'],
]

const VALID_CHALLENGE_CONFIG = {
  stakeAmt: '25',
  cancelFee: '1',
  rejectFee: '1',
  durationSeconds: '120',
  graceSeconds: '30',
  stealBounty: '35',
  friendshipSuccessFee: '0',
}

const VALID_BONUS_CONFIG = { payoutBps: '1000', maxTreasurySpendBps: '500', maxBonusPerSuccess: '10' }

beforeEach(() => {
  vi.clearAllMocks()
  writeContract.mockResolvedValue('0xhash')
  waitForTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 123n })
  getBlockNumber.mockImplementation(async () => 200n)
  readContract.mockImplementation(async (params: { address: Address; functionName: string }) => {
    // A funded wallet with a standing allowance, so a valid deposit needs no
    // approval step and reaches the contract call directly.
    if (params.address === usdcAddress) return 1_000_000_000_000n
    if (params.functionName === 'owner') return account
    if (params.functionName === 'isInMatchQueue') return false
    if (params.functionName === 'pairKey') return '0x01'
    if (params.functionName === 'pairChallenges') return ['0x0000000000000000000000000000000000000000']
    return 0n
  })
})

afterEach(cleanup)

async function renderLoadedHook() {
  const view = renderHook(() => useSocialTrust())
  await waitFor(() => expect(view.result.current.snapshot).toBeDefined())
  vi.clearAllMocks()
  return view
}

function argsOf(call: unknown) {
  return (call as { args: readonly unknown[] }).args
}

describe('USDC amount validation before a contract call', () => {
  it.each([
    ['a whole number', '10', 10_000_000n],
    ['a half', '0.5', 500_000n],
    ['full six-decimal precision', '1.123456', 1_123_456n],
    ['the smallest unit', '0.000001', 1n],
    ['a padded decimal', '25.00', 25_000_000n],
  ])('deposits %s', async (_label, input, expected) => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.deposit(input) })

    expect(ok).toBe(true)
    expect(writeContract).toHaveBeenCalledOnce()
    expect(argsOf(writeContract.mock.calls[0][0])).toEqual([expected])
  })

  it('parses zero, which the amount-greater-than-zero guard then refuses', async () => {
    // Zero is a valid number — it is rejected by a range check further on, not
    // by the parser, and still reaches no contract call.
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.deposit('0') })

    expect(ok).toBe(false)
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toBe('Enter an amount greater than zero.')
  })

  it.each(REJECTED_AMOUNTS)('refuses to deposit %s, sending no transaction', async (_label, input) => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.deposit(input) })

    expect(ok).toBe(false)
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.pending).toBe(false)
    expect(result.current.tx.error).toMatch(/up to 6 decimal places/)
  })

  it.each(REJECTED_AMOUNTS)('refuses to withdraw %s, sending no transaction', async (_label, input) => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.withdraw(input) })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it.each(REJECTED_AMOUNTS)('refuses to fund the bonus pool with %s', async (_label, input) => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.fundBonusPool(input) })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it.each(REJECTED_AMOUNTS)('refuses to deposit-and-match with %s', async (_label, input) => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.depositAndMatchMe(input) })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it.each(REJECTED_AMOUNTS)('refuses to deposit-and-stake with %s', async (_label, input) => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.depositAndStakeForFriendship(other, input) })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('still rejects a bad address before looking at the amount', async () => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.depositAndStakeForFriendship('nope', '10') })
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toBe('Enter a valid wallet address.')
  })
})

describe('admin integer validation before a contract call', () => {
  it('saves challenge settings when every field parses', async () => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.setChallengeConfig(VALID_CHALLENGE_CONFIG) })

    expect(ok).toBe(true)
    expect(argsOf(writeContract.mock.calls[0][0])).toEqual([
      25_000_000n, 1_000_000n, 1_000_000n, 120n, 30n, 35_000_000n, 0n,
    ])
  })

  it.each(REJECTED_INTEGERS)('refuses a challenge duration of %s', async (_label, durationSeconds) => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => {
      ok = await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, durationSeconds })
    })

    expect(ok).toBe(false)
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toMatch(/whole number|durations in seconds/)
  })

  it.each(REJECTED_INTEGERS)('refuses a steal grace period of %s', async (_label, graceSeconds) => {
    const { result } = await renderLoadedHook()
    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, graceSeconds })
    })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it.each(REJECTED_AMOUNTS)('refuses a stake amount of %s', async (_label, stakeAmt) => {
    const { result } = await renderLoadedHook()
    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, stakeAmt })
    })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('keeps the existing range constraints', async () => {
    const { result } = await renderLoadedHook()

    // A parseable zero duration is still out of range.
    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, durationSeconds: '0' })
    })
    expect(result.current.tx.error).toBe('Challenge duration must be greater than 0 seconds.')

    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, graceSeconds: '120' })
    })
    expect(result.current.tx.error).toBe('Steal grace must be less than challenge duration.')

    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, stealBounty: '20' })
    })
    expect(result.current.tx.error).toBe('Steal bounty must be greater than the stake amount.')

    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, stealBounty: '50' })
    })
    expect(result.current.tx.error).toBe('Steal bounty must be less than 2x the stake amount.')

    await act(async () => {
      await result.current.actions.setChallengeConfig({ ...VALID_CHALLENGE_CONFIG, friendshipSuccessFee: '25' })
    })
    expect(result.current.tx.error).toBe('Success fee must be less than the stake amount.')

    expect(writeContract).not.toHaveBeenCalled()
  })

  it('saves bonus settings when every field parses', async () => {
    const { result } = await renderLoadedHook()

    await act(async () => { await result.current.actions.setBonusConfig(VALID_BONUS_CONFIG) })

    expect(argsOf(writeContract.mock.calls[0][0])).toEqual([1_000n, 500n, 10_000_000n])
  })

  it.each(REJECTED_INTEGERS)('refuses a payout BPS of %s', async (_label, payoutBps) => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.setBonusConfig({ ...VALID_BONUS_CONFIG, payoutBps }) })

    expect(ok).toBe(false)
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toMatch(/basis-point/)
  })

  it.each(REJECTED_INTEGERS)('refuses a treasury BPS of %s', async (_label, maxTreasurySpendBps) => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.setBonusConfig({ ...VALID_BONUS_CONFIG, maxTreasurySpendBps }) })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it.each(REJECTED_AMOUNTS)('refuses a max bonus of %s', async (_label, maxBonusPerSuccess) => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.setBonusConfig({ ...VALID_BONUS_CONFIG, maxBonusPerSuccess }) })
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('sets a reputation score that parses', async () => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.setScore(other, '42') })

    expect(ok).toBe(true)
    expect(argsOf(writeContract.mock.calls[0][0])).toEqual([other, 42n])
  })

  it.each(REJECTED_INTEGERS)('refuses a reputation score of %s', async (_label, score) => {
    const { result } = await renderLoadedHook()

    let ok: unknown
    await act(async () => { ok = await result.current.actions.setScore(other, score) })

    expect(ok).toBe(false)
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toMatch(/reputation score/)
  })

  it('still rejects a bad address before looking at the score', async () => {
    const { result } = await renderLoadedHook()
    await act(async () => { await result.current.actions.setScore('nope', '42') })
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toBe('Enter a valid wallet address.')
  })
})
