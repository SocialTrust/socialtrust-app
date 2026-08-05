// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'

const account = '0x0000000000000000000000000000000000000001' as Address
const friend = '0x0000000000000000000000000000000000000002' as Address
const inviter = '0x0000000000000000000000000000000000000003' as Address
const stranger = '0x0000000000000000000000000000000000000004' as Address
const contractAddress = '0x00000000000000000000000000000000000000bb' as Address
const profilesAddress = '0x00000000000000000000000000000000000000aa' as Address

type ReadCall = { address: Address; functionName: string; args?: readonly unknown[]; blockNumber?: bigint }

const readContract = vi.fn<(params: ReadCall) => Promise<unknown>>()
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
  useAccount: () => ({ address: account, isConnected: true, chainId: 31337 }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(async () => undefined) }),
  useWalletClient: () => ({ data: { getChainId: async () => 31337, writeContract } }),
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal }),
}))

vi.mock('./lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/config')>()
  return {
    ...actual,
    appConfig: {
      ...actual.appConfig,
      contractAddress,
      profilesAddress,
      chainId: 31337,
      chainName: 'Test Chain',
      isConfigured: true,
      configProblems: [],
      hasProfiles: true,
      graphEnabled: true,
      graphUrl: 'https://graph.test/query',
    },
  }
})

const { default: App } = await import('./App')

const stake = 10_000_000n

const profiles: Record<string, { displayName: string; telegramUsername: string }> = {
  [account.toLowerCase()]: { displayName: 'Jamie', telegramUsername: 'jamietg' },
  [friend.toLowerCase()]: { displayName: 'Morgan', telegramUsername: '' },
  [inviter.toLowerCase()]: { displayName: 'Casey', telegramUsername: '' },
}

function profileFor(address: string) {
  const stored = profiles[address.toLowerCase()]
  return {
    displayName: stored?.displayName ?? '',
    xUsername: '',
    telegramUsername: stored?.telegramUsername ?? '',
    discordUsername: '',
    imgUrl: '',
    exists: Boolean(stored),
  }
}

const pendingIncoming = {
  id: 'cp-1',
  pairKey: '0x01',
  account: account,
  other: inviter,
  status: 'PENDING',
  updatedAt: '10',
  challenge: {
    id: 'c-1',
    pairKey: '0x01',
    account0: account,
    account1: inviter,
    stakeAmount: String(stake),
    cancelPendingStakeFee: '0',
    rejectPendingStakeFee: '0',
    challengeDuration: '86400',
    stealGracePeriod: '3600',
    stealBounty: '15000000',
    friendshipSuccessFee: '0',
    staked0: false,
    staked1: true,
    challengeStartedAt: '0',
    stealAllowedAt: '0',
    challengeEndsAt: '0',
    status: 'PENDING',
  },
}

function graphPayload(user: string) {
  if (user.toLowerCase() !== account.toLowerCase()) {
    return { challengeParticipants: [], friendships: [], activities: [] }
  }
  return {
    challengeParticipants: [pendingIncoming],
    friendships: [{ id: 'f-1', pairKey: '0x02', user: account, friend, finalizedAt: '5', transactionHash: '0xabc' }],
    activities: [{
      id: 'a-1',
      user: account,
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

let ownerAddress: Address = friend

function setPath(path: string) {
  window.history.pushState({}, '', path)
}

beforeEach(() => {
  vi.clearAllMocks()
  ownerAddress = friend
  setPath('/')
  window.scrollTo = vi.fn()
  getBlockNumber.mockImplementation(async () => 200n)
  writeContract.mockResolvedValue('0xhash')
  waitForTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 123n })

  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as { variables?: { user?: string } }
    return {
      ok: true,
      json: async () => ({ data: graphPayload(body.variables?.user ?? '') }),
    }
  }))

  readContract.mockImplementation(async (params: ReadCall) => {
    if (params.address === profilesAddress) {
      if (params.functionName === 'getProfiles') return (params.args?.[0] as Address[]).map(profileFor)
      return profileFor(String(params.args?.[0] ?? ''))
    }
    switch (params.functionName) {
      case 'owner': return ownerAddress
      case 'balances': return 50_000_000n
      case 'repScore': return 82n
      case 'stakeAmt': return stake
      case 'matchFee': return 1_000_000n
      case 'matchTimeLimit': return 259_200n
      case 'challengeDuration': return 86_400n
      case 'stealGracePeriod': return 3_600n
      case 'stealBounty': return 15_000_000n
      case 'isInMatchQueue': return false
      case 'activeMatchIdOf': return 0n
      case 'areFriends': return false
      case 'pairKey': return '0x01'
      case 'getChallengeView': return { account0: '0x0000000000000000000000000000000000000000' }
      default: return 0n
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const nav = () => document.querySelector('nav.bottomNav') as HTMLElement
const tab = (name: string) => within(nav()).getByRole('link', { name })
const pageTitle = (name: string) => screen.findByRole('heading', { level: 1, name })

async function renderApp() {
  render(<App />)
  await waitFor(() => expect(nav()).toBeTruthy())
}

describe('App shell navigation', () => {
  it('runs the normal app, with no configuration error, when the deployment is configured', async () => {
    await renderApp()
    expect(screen.queryByRole('heading', { name: 'Configuration required' })).toBeNull()
    expect(screen.queryByText(/VITE_/)).toBeNull()
    // Real contract data, read from the chain rather than fabricated.
    expect(await screen.findByRole('heading', { name: 'Ready to build trust?' })).toBeTruthy()
    expect(readContract).toHaveBeenCalled()
  })

  it('opens Home with the matchmaking hero and the Home tab selected', async () => {
    await renderApp()
    expect(await screen.findByRole('heading', { name: 'Ready to build trust?' })).toBeTruthy()
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
  })

  it('keeps the general activity feed off Home', async () => {
    await renderApp()
    await screen.findByRole('heading', { name: 'Ready to build trust?' })
    // The needs-attention section is present…
    expect(screen.getByText('Needs attention')).toBeTruthy()
    // …but the historical feed is not: it belongs to the Activity tab.
    await waitFor(() => expect(screen.queryByText('Recent activity')).toBeNull())
    expect(screen.queryByText('Deposit')).toBeNull()
  })

  it('moves between tabs, updating the header, content, and selected state', async () => {
    await renderApp()

    await userEvent.click(tab('Friends'))
    expect(await pageTitle('Friends')).toBeTruthy()
    expect(tab('Friends').getAttribute('aria-current')).toBe('page')
    expect(window.location.pathname).toBe('/friends')

    await userEvent.click(tab('Activity'))
    expect(await pageTitle('Activity')).toBeTruthy()
    expect(tab('Activity').getAttribute('aria-current')).toBe('page')

    await userEvent.click(tab('Account'))
    expect(await pageTitle('Account')).toBeTruthy()
    expect(tab('Account').getAttribute('aria-current')).toBe('page')
  })

  it('renders the indexed activity feed on the Activity tab', async () => {
    setPath('/activity')
    await renderApp()
    expect(await screen.findByText('Deposit')).toBeTruthy()
    expect(screen.getByText('+25.00 USDC')).toBeTruthy()
  })

  it('loads a public profile directly and keeps the Friends tab selected', async () => {
    setPath(`/account/${friend}`)
    await renderApp()
    expect(await screen.findByRole('heading', { name: 'Morgan' })).toBeTruthy()
    expect(tab('Friends').getAttribute('aria-current')).toBe('page')
  })

  it('shows a not-found screen for an unknown route', async () => {
    setPath('/nope')
    await renderApp()
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })

  it('follows browser back to the previous destination', async () => {
    await renderApp()
    await userEvent.click(tab('Friends'))
    await pageTitle('Friends')

    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(await screen.findByRole('heading', { name: 'Ready to build trust?' })).toBeTruthy()
  })
})

describe('Start friendship from Friends', () => {
  it('opens the bottom sheet from the header action', async () => {
    setPath('/friends')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: 'Start friendship' }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Start friendship' })).toBeTruthy()
    expect(within(sheet).getByLabelText(/paste their wallet address/i)).toBeTruthy()
    // The navigation stays rendered but stops taking input while the sheet is up.
    expect(nav().hasAttribute('inert')).toBe(true)
  })

  it('closes the sheet and confirms once the stake is submitted', async () => {
    setPath('/friends')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: 'Start friendship' }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.type(within(sheet).getByLabelText(/paste their wallet address/i), stranger)

    const submit = await within(sheet).findByRole('button', { name: /^Stake 10\.00 USDC$/ })
    await userEvent.click(submit)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'stakeForFriendship' }))
    expect(await screen.findByText('Stake locked.')).toBeTruthy()
  })

  it('refuses to pair an account with itself', async () => {
    setPath('/friends')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: 'Start friendship' }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.type(within(sheet).getByLabelText(/paste their wallet address/i), account)

    expect(within(sheet).getByText(/cannot start a friendship with your own account/i)).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: /Stake|Deposit/ }).hasAttribute('disabled')).toBe(true)
  })
})

describe('Account and public profile data isolation', () => {
  it('shows funds and controls on the connected user’s Account tab', async () => {
    setPath('/me')
    await renderApp()

    expect(await screen.findByText('SocialTrust app balance')).toBeTruthy()
    expect(screen.getByText('50.00 USDC')).toBeTruthy()
    expect(screen.getByText('Disconnect wallet')).toBeTruthy()
  })

  it('shows admin controls only when the connected account owns the contract', async () => {
    setPath('/me')
    await renderApp()
    await screen.findByText('SocialTrust app balance')
    expect(screen.queryByText('Admin controls')).toBeNull()

    cleanup()
    ownerAddress = account
    setPath('/me')
    await renderApp()
    expect(await screen.findByText('Admin controls')).toBeTruthy()
  })

  it('never shows balances or self-only controls on someone else’s profile', async () => {
    setPath(`/account/${friend}`)
    await renderApp()
    await screen.findByRole('heading', { name: 'Morgan' })

    expect(screen.queryByText('SocialTrust app balance')).toBeNull()
    expect(screen.queryByText('Wallet USDC')).toBeNull()
    expect(screen.queryByText('Disconnect wallet')).toBeNull()
    expect(screen.queryByRole('button', { name: /Edit profile/ })).toBeNull()
  })
})

describe('Home header metrics', () => {
  it('stacks balance over reputation with accessible labels and no visible field names', async () => {
    await renderApp()
    const balance = await screen.findByLabelText('App balance 50.00 USDC')
    const reputation = screen.getByLabelText('Reputation 82')

    // Same stacked container, balance first.
    expect(balance.parentElement).toBe(reputation.parentElement)
    expect(balance.compareDocumentPosition(reputation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The labels are for assistive tech only; the header shows symbols.
    expect(balance.textContent).toBe('$50.00')
    expect(reputation.textContent).toBe('★82')
  })

  it('shows placeholders, not zeros, while the account snapshot is still loading', async () => {
    // A balance read that never settles keeps the snapshot undefined.
    readContract.mockImplementation(async (params: ReadCall) => {
      if (params.functionName === 'balances') return new Promise(() => {})
      if (params.address === profilesAddress) return profileFor(String(params.args?.[0] ?? ''))
      if (params.functionName === 'owner') return friend
      return 0n
    })

    await renderApp()

    expect(await screen.findByLabelText('App balance — USDC')).toBeTruthy()
    expect(screen.getByLabelText('Reputation —')).toBeTruthy()
    expect(screen.queryByLabelText(/App balance 0\.00 USDC/)).toBeNull()
  })
})

describe('Needs attention', () => {
  it('surfaces an incoming invitation with its actions', async () => {
    await renderApp()
    expect(await screen.findByText('Casey')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })
})
