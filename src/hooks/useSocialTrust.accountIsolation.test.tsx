// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { UserSnapshot } from '../types'

const ACCOUNT_A = '0x000000000000000000000000000000000000000a' as Address
const ACCOUNT_B = '0x000000000000000000000000000000000000000b' as Address
const FRIEND_A = '0x00000000000000000000000000000000000000fa' as Address
const FRIEND_B = '0x00000000000000000000000000000000000000fb' as Address
const contractAddress = '0x00000000000000000000000000000000000000bb' as Address
const profilesAddress = '0x00000000000000000000000000000000000000aa' as Address

const BALANCE = { [ACCOUNT_A]: 111_000_000n, [ACCOUNT_B]: 222_000_000n } as Record<string, bigint>
const REP = { [ACCOUNT_A]: 11n, [ACCOUNT_B]: 22n } as Record<string, bigint>
const FRIEND_OF = { [ACCOUNT_A]: FRIEND_A, [ACCOUNT_B]: FRIEND_B } as Record<string, Address>

/** A promise the test opens by hand, so responses can be ordered precisely. */
class Gate {
  private resolveFn!: () => void
  readonly promise = new Promise<void>((resolve) => { this.resolveFn = resolve })
  open() { this.resolveFn() }
}

/** Gates keyed by the account whose reads they hold up. */
let gates: Map<string, Gate>
/** Accounts whose Graph query should reject. */
let graphFails: Set<string>

let connectedAccount: Address | undefined = ACCOUNT_A

const readContract = vi.fn()
const getBlockNumber = vi.fn(async () => 200n)

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({ readContract, getBlockNumber, waitForTransactionReceipt: vi.fn() }),
  }
})

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: connectedAccount, isConnected: Boolean(connectedAccount), chainId: 31337 }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(async () => undefined) }),
  useWalletClient: () => ({ data: undefined }),
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
      isMockMode: false,
      hasProfiles: false,
      graphEnabled: true,
      graphUrl: 'https://graph.test/query',
    },
  }
})

const { useSocialTrust } = await import('./useSocialTrust')

async function holdFor(user: unknown) {
  if (typeof user !== 'string') return
  const gate = gates.get(user.toLowerCase())
  if (gate) await gate.promise
}

function graphPayload(user: string) {
  const friend = FRIEND_OF[user as Address]
  if (!friend) return { challengeParticipants: [], friendships: [], activities: [] }
  return {
    challengeParticipants: [],
    friendships: [{ id: `f-${user}`, pairKey: '0x02', user, friend, finalizedAt: '5', transactionHash: '0xabc' }],
    activities: [{
      id: `activity-${user}`,
      user,
      pairKey: null,
      other: null,
      activityType: 'DEPOSIT',
      amount: '25000000',
      bonusAmount: null,
      matchFeeRefund: null,
      matchId: null,
      timestamp: '100',
      blockNumber: '10',
      transactionHash: '0xdef',
    }],
  }
}

/**
 * Records which account was connected and which snapshot the hook exposed on
 * every single render. Clearing in an effect leaves one committed render where
 * the pair disagrees, and only a per-render record can see it.
 */
type RenderRecord = { currentAccount: Address | undefined; snapshot: UserSnapshot | undefined }

const rendered: RenderRecord[] = []
let hookResult: ReturnType<typeof useSocialTrust>

function Probe() {
  hookResult = useSocialTrust()
  rendered.push({ currentAccount: connectedAccount, snapshot: hookResult.snapshot })
  return null
}

function renderProbe() {
  const view = render(<Probe />)
  return { rerender: () => view.rerender(<Probe />) }
}

/** Does this snapshot carry any data belonging to `account`? */
function carriesDataFor(snapshot: UserSnapshot | undefined, account: Address) {
  if (!snapshot) return false
  return snapshot.appBalance === BALANCE[account]
    || snapshot.repScore === REP[account]
    || snapshot.friends.some((friend) => friend.toLowerCase() === FRIEND_OF[account].toLowerCase())
    || snapshot.recentActivity.some((item) => item.id === `activity-${account.toLowerCase()}`)
}

/** Every render that exposed the given account's data. */
function rendersShowing(account: Address) {
  return rendered.filter((record) => carriesDataFor(record.snapshot, account))
}

/**
 * Renders where the connected account and the exposed snapshot disagree:
 * account B, or a disconnected wallet, paired with account A's data. Must
 * always be empty — including for a render that was committed and then
 * immediately replaced by an effect.
 */
function mismatchedRenders(previous: Address) {
  return rendered.filter((record) => {
    if (!carriesDataFor(record.snapshot, previous)) return false
    // Showing A's data is only legitimate while A is the connected account.
    return !record.currentAccount || record.currentAccount.toLowerCase() !== previous.toLowerCase()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  rendered.length = 0
  gates = new Map()
  graphFails = new Set()
  connectedAccount = ACCOUNT_A
  getBlockNumber.mockImplementation(async () => 200n)

  readContract.mockImplementation(async (params: { functionName: string; args?: readonly unknown[] }) => {
    const user = params.args?.[0]
    await holdFor(user)
    switch (params.functionName) {
      case 'balances': return BALANCE[String(user)] ?? 0n
      case 'repScore': return REP[String(user)] ?? 7n
      case 'owner': return ACCOUNT_A
      case 'isInMatchQueue': return false
      case 'activeMatchIdOf': return 0n
      default: return 0n
    }
  })

  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as { variables?: { user?: string } }
    const user = body.variables?.user ?? ''
    await holdFor(user)
    if (graphFails.has(user.toLowerCase())) throw new Error('The Graph is unavailable.')
    return { ok: true, json: async () => ({ data: graphPayload(user) }) }
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Lets queued microtasks and detached follow-up work settle. */
async function settle(ms = 30) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })
}

describe('account state isolation', () => {
  it('discards a slow response for the previous account when A resolves last', async () => {
    const gateA = new Gate()
    gates.set(ACCOUNT_A.toLowerCase(), gateA)

    const { rerender } = renderProbe()
    await settle()
    // A's load is still in flight.
    expect(hookResult.snapshot).toBeUndefined()

    // Switch to B, whose reads are not gated.
    connectedAccount = ACCOUNT_B
    await act(async () => { rerender() })
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_B]))

    // Now let A's load finish — last.
    await act(async () => { gateA.open() })
    await settle()

    expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_B])
    expect(hookResult.snapshot?.repScore).toBe(REP[ACCOUNT_B])
    expect(hookResult.snapshot?.friends).toEqual([FRIEND_B])
    // A's data was never rendered, not even for one commit.
    expect(rendersShowing(ACCOUNT_A)).toEqual([])
    expect(mismatchedRenders(ACCOUNT_A)).toEqual([])
  })

  it('clears account state immediately on switch, before the new load arrives', async () => {
    const { rerender } = renderProbe()
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_A]))

    // Hold B's reads so the gap between switching and loading is observable.
    const gateB = new Gate()
    gates.set(ACCOUNT_B.toLowerCase(), gateB)

    connectedAccount = ACCOUNT_B
    await act(async () => { rerender() })

    // The moment the account changes, A's data is gone rather than lingering.
    expect(hookResult.snapshot).toBeUndefined()

    await act(async () => { gateB.open() })
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_B]))
    expect(hookResult.snapshot?.friends).toEqual([FRIEND_B])
  })

  it('never renders account B alongside account A’s snapshot, not even once', async () => {
    // The first render after a switch happens before any effect runs, so a
    // snapshot cleared in useEffect is still on screen for that commit.
    const { rerender } = renderProbe()
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_A]))

    // Hold B's reads so the only thing that can clear A's data is the
    // render-time ownership check.
    gates.set(ACCOUNT_B.toLowerCase(), new Gate())

    connectedAccount = ACCOUNT_B
    await act(async () => { rerender() })
    await settle()

    expect(mismatchedRenders(ACCOUNT_A)).toEqual([])
    // Every render that showed A's data had A connected.
    expect(rendersShowing(ACCOUNT_A).every((record) => record.currentAccount === ACCOUNT_A)).toBe(true)
    // And B's renders show nothing until B's own data arrives.
    expect(rendered.filter((record) => record.currentAccount === ACCOUNT_B)
      .every((record) => record.snapshot === undefined)).toBe(true)
  })

  it('never renders a disconnected wallet alongside the last account’s snapshot', async () => {
    const { rerender } = renderProbe()
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_A]))

    connectedAccount = undefined
    await act(async () => { rerender() })
    await settle()

    expect(mismatchedRenders(ACCOUNT_A)).toEqual([])
    expect(rendered.filter((record) => record.currentAccount === undefined)
      .every((record) => record.snapshot === undefined)).toBe(true)
  })

  it('drops everything when the wallet disconnects mid-load', async () => {
    const gateA = new Gate()
    gates.set(ACCOUNT_A.toLowerCase(), gateA)

    const { rerender } = renderProbe()
    await settle()

    connectedAccount = undefined
    await act(async () => { rerender() })
    expect(hookResult.snapshot).toBeUndefined()

    // The pending load resolves after the disconnect and must be discarded.
    await act(async () => { gateA.open() })
    await settle()

    expect(hookResult.snapshot).toBeUndefined()
    expect(rendersShowing(ACCOUNT_A)).toEqual([])
    expect(mismatchedRenders(ACCOUNT_A)).toEqual([])
  })

  it('drops a fully loaded account on disconnect', async () => {
    const { rerender } = renderProbe()
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_A]))

    connectedAccount = undefined
    await act(async () => { rerender() })

    expect(hookResult.snapshot).toBeUndefined()
  })

  it('never reuses the previous account’s lists when the Graph fails after a switch', async () => {
    const { rerender } = renderProbe()
    await waitFor(() => expect(hookResult.snapshot?.friends).toEqual([FRIEND_A]))
    expect(hookResult.snapshot?.recentActivity).toHaveLength(1)

    // B connects and its Graph query fails: the fallback must not borrow A's
    // friends, challenges or activity.
    graphFails.add(ACCOUNT_B.toLowerCase())
    connectedAccount = ACCOUNT_B
    await act(async () => { rerender() })
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_B]))
    await settle()

    expect(hookResult.snapshot?.friends).toEqual([])
    expect(hookResult.snapshot?.challenges).toEqual([])
    expect(hookResult.snapshot?.recentActivity).toEqual([])
    expect(hookResult.snapshot?.friendCount).toBe(0n)
    expect(hookResult.activityError).toBeDefined()
    expect(rendersShowing(ACCOUNT_A).every((record) => record.currentAccount === ACCOUNT_A)).toBe(true)
    // No render mixed B's balance with A's lists.
    expect(rendered.some(({ snapshot }) =>
      snapshot?.appBalance === BALANCE[ACCOUNT_B]
      && snapshot.friends.some((friend) => friend.toLowerCase() === FRIEND_A.toLowerCase()),
    )).toBe(false)
    expect(mismatchedRenders(ACCOUNT_A)).toEqual([])
  })

  it('still preserves the same account’s lists when its own Graph query fails', async () => {
    const { rerender } = renderProbe()
    await waitFor(() => expect(hookResult.snapshot?.friends).toEqual([FRIEND_A]))

    // Same wallet, refreshed while the indexer is down: keeping the last known
    // lists is correct here, because they belong to this account.
    graphFails.add(ACCOUNT_A.toLowerCase())
    await act(async () => { await hookResult.refresh() })
    await settle()

    expect(hookResult.snapshot?.friends).toEqual([FRIEND_A])
    expect(hookResult.snapshot?.recentActivity).toHaveLength(1)
    expect(hookResult.activityError).toBeDefined()
    rerender()
  })

  it('stops a stale response from writing state or the snapshot ref', async () => {
    const gateA = new Gate()
    gates.set(ACCOUNT_A.toLowerCase(), gateA)

    const { rerender } = renderProbe()
    await settle()

    connectedAccount = ACCOUNT_B
    await act(async () => { rerender() })
    await waitFor(() => expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_B]))

    const beforeStale = hookResult.snapshot

    // A's response lands late. If it could write the ref, the next merge for B
    // would spread A's data back into view.
    await act(async () => { gateA.open() })
    await settle()

    // Force another commit for B; it bases on the ref.
    await act(async () => { await hookResult.refresh() })
    await settle()

    expect(hookResult.snapshot?.appBalance).toBe(BALANCE[ACCOUNT_B])
    expect(hookResult.snapshot?.repScore).toBe(REP[ACCOUNT_B])
    expect(hookResult.snapshot?.friends).toEqual([FRIEND_B])
    expect(hookResult.snapshot?.recentActivity.map((item) => item.id)).toEqual([`activity-${ACCOUNT_B.toLowerCase()}`])
    expect(beforeStale?.appBalance).toBe(BALANCE[ACCOUNT_B])
    expect(rendersShowing(ACCOUNT_A)).toEqual([])
    expect(mismatchedRenders(ACCOUNT_A)).toEqual([])
  })
})
