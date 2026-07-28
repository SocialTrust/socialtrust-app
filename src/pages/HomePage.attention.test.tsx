// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { ChallengeView, ContractConfig, SocialProfile, UserSnapshot } from '../types'
import { HomePage } from './HomePage'
import { FriendsPage } from './FriendsPage'

const account = '0x0000000000000000000000000000000000000001' as Address
const safePartner = '0x0000000000000000000000000000000000000002' as Address
const inviter = '0x0000000000000000000000000000000000000003' as Address

const NOW = 1_000

const baseChallenge = {
  stakeAmount: 25_000_000n,
  cancelPendingStakeFee: 1_000_000n,
  rejectPendingStakeFee: 1_000_000n,
  challengeDuration: 2_000n,
  stealGracePeriod: 1_000n,
  stealBounty: 35_000_000n,
  friendshipSuccessFee: 0n,
}

// Running normally: both staked, the steal window has not opened yet.
const activeSafe: ChallengeView = {
  ...baseChallenge,
  pairKey: '0xaaa',
  account0: account,
  account1: safePartner,
  other: safePartner,
  userStaked: true,
  otherStaked: true,
  active: true,
  challengeStartedAt: 900n,
  stealAllowedAt: 2_000n,
  challengeEndsAt: 3_000n,
}

// Waiting on the user: an invite they have not answered.
const pendingIncoming: ChallengeView = {
  ...baseChallenge,
  pairKey: '0xbbb',
  account0: account,
  account1: inviter,
  other: inviter,
  userStaked: false,
  otherStaked: true,
  active: false,
  challengeStartedAt: 0n,
  stealAllowedAt: 0n,
  challengeEndsAt: 0n,
}

const config = {
  stakeAmt: 25_000_000n,
  cancelPendingStakeFee: 1_000_000n,
  rejectPendingStakeFee: 1_000_000n,
  challengeDuration: 2_000n,
  stealGracePeriod: 1_000n,
  stealBounty: 35_000_000n,
  friendshipSuccessFee: 0n,
  payoutBps: 0n,
  maxTreasurySpendBps: 0n,
  maxBonusPerSuccess: 0n,
  matchFee: 3_000_000n,
  matchTimeLimit: 600n,
  maxMatchScan: 10n,
  matchQueueCancelFee: 0n,
  bonusPool: 0n,
  totalBonusPaid: 0n,
} satisfies ContractConfig

function snapshotWith(challenges: ChallengeView[]): UserSnapshot {
  return {
    walletUsdc: 0n,
    appBalance: 50_000_000n,
    pendingBonus: 0n,
    bonusPaidTo: 0n,
    repScore: 0n,
    allowance: 0n,
    friendCount: 0n,
    friends: [],
    challenges,
    recentActivity: [],
  }
}

afterEach(cleanup)

function renderHome(overrides: { config?: ContractConfig; challenges?: ChallengeView[]; isConnected?: boolean } = {}) {
  render(
    <HomePage
      account={account}
      isConnected={overrides.isConnected ?? true}
      config={'config' in overrides ? overrides.config : config}
      snapshot={snapshotWith(overrides.challenges ?? [])}
      isLoading={false}
      onConnect={vi.fn()}
      onStartWith={vi.fn()}
      onFindMatch={vi.fn()}
      onDepositAndMatchMe={vi.fn()}
      onCancelMatch={vi.fn()}
      readSocialProfile={vi.fn(async () => ({} as SocialProfile))}
      onSetProfile={vi.fn(async () => true)}
      onOpenChallenge={vi.fn()}
      onFinalize={vi.fn()}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onCancel={vi.fn()}
      onNavigate={vi.fn()}
      nowSeconds={NOW}
    />,
  )
}

function renderFriends(challenges: ChallengeView[]) {
  render(
    <FriendsPage
      isConnected
      snapshot={snapshotWith(challenges)}
      isLoading={false}
      nowSeconds={NOW}
      onConnect={vi.fn()}
      onStartFriendship={vi.fn()}
      onOpenChallenge={vi.fn()}
      onFinalize={vi.fn()}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onCancel={vi.fn()}
      onNavigate={vi.fn()}
    />,
  )
}

describe('Home needs-attention filtering', () => {
  it('leaves a safe active challenge off Home', () => {
    renderHome({ challenges: [activeSafe] })
    expect(screen.queryByText(/Open challenge with/)).toBeNull()
    expect(screen.getByText(/Nothing needs you right now/)).toBeTruthy()
  })

  it('still surfaces actionable states on Home', () => {
    renderHome({ challenges: [pendingIncoming] })
    expect(screen.getByRole('button', { name: /Open challenge with/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
  })

  it('shows only the actionable item when both kinds exist', () => {
    renderHome({ challenges: [activeSafe, pendingIncoming] })
    expect(screen.getAllByRole('button', { name: /Open challenge with/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })
})

describe('Friends in-progress list', () => {
  it('keeps the safe active challenge', () => {
    renderFriends([activeSafe])
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open challenge with/ })).toBeTruthy()
    expect(screen.getByText(/Steal opens in/)).toBeTruthy()
  })

  it('lists safe and actionable challenges together', () => {
    renderFriends([activeSafe, pendingIncoming])
    expect(screen.getAllByRole('button', { name: /Open challenge with/ })).toHaveLength(2)
  })
})

describe('Home while contract configuration is still loading', () => {
  it('renders placeholders instead of zero protocol values when disconnected', () => {
    renderHome({ isConnected: false, config: undefined })

    const params = screen.getByText('Current parameters').closest('section')!
    expect(params.textContent).not.toContain('0.00 USDC')
    expect(params.textContent).not.toContain('0s')
    expect(params.textContent).not.toContain('after 0s')
    // Four unread parameters, four placeholders.
    expect(params.querySelectorAll('dd')).toHaveLength(4)
    Array.from(params.querySelectorAll('dd')).forEach((dd) => expect(dd.textContent).toBe('—'))
  })

  it('renders the real values once configuration arrives', () => {
    renderHome({ isConnected: false })
    const params = screen.getByText('Current parameters').closest('section')!
    expect(params.textContent).toContain('25.00 USDC')
    expect(params.textContent).toContain('after 16m 40s')
  })

  it('holds the matchmaking caption with placeholders rather than a zero fee', () => {
    renderHome({ config: undefined })
    expect(screen.getByText('— USDC fee · —')).toBeTruthy()
    expect(screen.queryByText(/0\.00 USDC fee/)).toBeNull()
    // Nothing to match against yet, so the action waits.
    expect((screen.getByRole('button', { name: 'Find a match' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('formats a sub-day match window without rounding it to a day', () => {
    renderHome()
    expect(screen.getByText('3.00 USDC fee · 10 minutes')).toBeTruthy()
  })
})
