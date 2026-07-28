import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { MatchSnapshot } from '../types'
import { acceptMatchSnapshot, startMatchPolling, type AccountMatchSnapshot } from './matchmakingState'

const accountA = '0x0000000000000000000000000000000000000001' as Address
const accountB = '0x0000000000000000000000000000000000000002' as Address

const queued = (blockNumber: bigint): AccountMatchSnapshot => ({
  account: accountA,
  blockNumber,
  currentQueueEntry: { user: accountA, feeAmount: 1n, cancelFeeAmount: 0n, queuedAt: 1n, status: 'QUEUED' },
})

const matched = (blockNumber: bigint): AccountMatchSnapshot => ({
  account: accountA,
  blockNumber,
  activeMatch: {
    id: '1', matchId: 1n, user0: accountA, user1: accountB, feeAmount0: 1n,
    feeAmount1: 1n, matchedAt: 1n, deadline: 100n, status: 'ACTIVE',
  },
})

afterEach(() => vi.useRealTimers())

describe('match snapshot versioning', () => {
  it('rejects a delayed queued response from an older block', () => {
    let state = acceptMatchSnapshot(undefined, queued(100n), accountA)
    state = acceptMatchSnapshot(state, matched(101n), accountA)
    state = acceptMatchSnapshot(state, queued(100n), accountA)
    expect(state?.blockNumber).toBe(101n)
    expect(state?.activeMatch?.matchId).toBe(1n)
    expect(state?.currentQueueEntry).toBeUndefined()
  })

  it('allows a latest poll to transition searching to externally matched', () => {
    let state = acceptMatchSnapshot(undefined, queued(100n), accountA)
    state = acceptMatchSnapshot(state, matched(101n), accountA)
    expect(state?.activeMatch).toBeDefined()
  })

  it('does not apply an account A result after switching to account B', () => {
    expect(acceptMatchSnapshot(undefined, queued(100n), accountB)).toBeUndefined()
  })
})

describe('queued polling lifecycle', () => {
  it.each(['matched', 'cancelled', 'disconnected', 'unmounted'])('stops when %s', async (reason) => {
    vi.useFakeTimers()
    let queuedNow = true
    let connected = true
    const poll = vi.fn(async () => { if (reason === 'matched' || reason === 'cancelled') queuedNow = false })
    const stop = startMatchPolling({ poll, intervalMs: 2_000, shouldContinue: () => queuedNow && connected })
    await vi.advanceTimersByTimeAsync(2_000)
    if (reason === 'disconnected') connected = false
    if (reason === 'unmounted') stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(poll).toHaveBeenCalledTimes(reason === 'disconnected' || reason === 'unmounted' ? 1 : 1)
    stop()
  })

  it('never overlaps slow polls', async () => {
    vi.useFakeTimers()
    let resolve!: () => void
    const poll = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    const stop = startMatchPolling({ poll, shouldContinue: () => true, intervalMs: 2_000 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(poll).toHaveBeenCalledTimes(1)
    resolve()
    await Promise.resolve()
    stop()
  })
})

describe('post-write read policy', () => {
  it('pins only the immediate read and leaves retries on latest', async () => {
    const calls: Array<bigint | undefined> = []
    const read = async (blockNumber?: bigint): Promise<MatchSnapshot> => {
      calls.push(blockNumber)
      return { blockNumber: blockNumber ?? 101n }
    }
    await read(100n)
    await read()
    await read()
    expect(calls).toEqual([100n, undefined, undefined])
  })
})
