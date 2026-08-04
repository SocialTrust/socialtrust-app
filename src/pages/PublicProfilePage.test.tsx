// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { AccountProfile, SocialProfile } from '../types'
import { PublicProfilePage } from './PublicProfilePage'

const viewer = '0x0000000000000000000000000000000000000001' as Address
const other = '0x0000000000000000000000000000000000000002' as Address
const friend = '0x0000000000000000000000000000000000000003' as Address

const otherProfile: SocialProfile = {
  displayName: 'Morgan',
  xUsername: 'morgan_x',
  telegramUsername: 'morgantg',
  discordUsername: '',
  imgUrl: '',
  exists: true,
}

// Deliberately includes self-only fields: the page must never render them, even
// if a payload carries them.
const accountProfile: AccountProfile = {
  address: other,
  friendCount: 1n,
  challengeCount: 0n,
  repScore: 61n,
  pendingBonus: 1_250_000n,
  bonusPaidTo: 4_500_000n,
  friends: [friend],
  challenges: [],
  appBalance: 999_123_456n,
  walletUsdc: 888_123_456n,
  allowance: 777_123_456n,
  isFriendWithViewer: false,
  socialProfile: otherProfile,
  friendProfiles: {},
  friendRepScores: { [friend.toLowerCase()]: 12n },
}

afterEach(cleanup)

type PublicProfileProps = Parameters<typeof PublicProfilePage>[0]

function setup(overrides: Partial<PublicProfileProps> = {}, profile: AccountProfile = accountProfile) {
  const props: PublicProfileProps = {
    address: other,
    connectedAccount: viewer,
    isConnected: true,
    readAccountProfile: vi.fn(async () => profile),
    onConnect: vi.fn(),
    onStartWith: vi.fn(),
    onOpenChallenge: vi.fn(),
    onNavigate: vi.fn(),
    nowSeconds: 0,
    ...overrides,
  }
  render(<PublicProfilePage {...props} />)
  return props
}

describe('PublicProfilePage', () => {
  it('shows the public identity, reputation, friend count, and handles', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Morgan' })).toBeTruthy()
    const stats = screen.getByLabelText('Public stats')
    expect(stats.textContent).toContain('61')
    expect(stats.textContent).toContain('Friends')
    expect(screen.getByText('@morgan_x')).toBeTruthy()
    expect(screen.getByText('@morgantg')).toBeTruthy()
    // Discord is absent from the stored profile, so no empty row is invented.
    expect(screen.queryByText('Discord')).toBeNull()
  })

  it('never exposes another account’s balances, allowance, or private controls', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Morgan' })

    expect(screen.queryByText(/999\.12/)).toBeNull()
    expect(screen.queryByText(/888\.12/)).toBeNull()
    expect(screen.queryByText(/777\.12/)).toBeNull()
    expect(screen.queryByText(/app balance/i)).toBeNull()
    expect(screen.queryByText(/Wallet USDC/i)).toBeNull()
    expect(screen.queryByText(/allowance/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Edit profile/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Admin/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Disconnect/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Deposit|Withdraw/ })).toBeNull()
  })

  it('offers a friendship action for a stranger', async () => {
    const { onStartWith } = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Start friendship' }))
    expect(onStartWith).toHaveBeenCalledWith(other)
  })

  it('says they are already friends instead of offering a new stake', async () => {
    setup({}, { ...accountProfile, isFriendWithViewer: true })
    expect(await screen.findByText('You and this account are friends.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start friendship' })).toBeNull()
  })

  it('opens the existing challenge when one is already running', async () => {
    const relationshipChallenge = {
      pairKey: '0xaa' as `0x${string}`,
      account0: viewer,
      account1: other,
      other,
      stakeAmount: 10_000_000n,
      cancelPendingStakeFee: 0n,
      rejectPendingStakeFee: 0n,
      challengeDuration: 100n,
      stealGracePeriod: 10n,
      stealBounty: 15_000_000n,
      friendshipSuccessFee: 0n,
      userStaked: true,
      otherStaked: false,
      active: false,
      challengeStartedAt: 0n,
      stealAllowedAt: 0n,
      challengeEndsAt: 0n,
    }
    const { onOpenChallenge } = setup({}, { ...accountProfile, relationshipChallenge })
    await userEvent.click(await screen.findByRole('button', { name: /Open challenge/ }))
    expect(onOpenChallenge).toHaveBeenCalledWith(relationshipChallenge)
  })

  it('points the viewer at their own Account tab instead of a public copy of it', async () => {
    const { onNavigate } = setup({ connectedAccount: other })
    await userEvent.click(await screen.findByRole('button', { name: /This is your account/ }))
    expect(onNavigate).toHaveBeenCalledWith('/me')
    expect(screen.queryByRole('button', { name: 'Start friendship' })).toBeNull()
  })

  it('navigates to a friend’s public profile from the friends list', async () => {
    const { onNavigate } = setup()
    await userEvent.click(await screen.findByRole('link', { name: /Open 0x00/ }))
    expect(onNavigate).toHaveBeenCalledWith(`/account/${friend}`)
  })

  it('surfaces a read failure instead of rendering empty data as real', async () => {
    setup({ readAccountProfile: vi.fn(async () => { throw new Error('RPC failed') }) })
    expect(await screen.findByText('RPC failed')).toBeTruthy()
    expect(screen.queryByLabelText('Public stats')).toBeNull()
  })
})
