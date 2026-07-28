// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { ContractConfig, SocialProfile, UserSnapshot } from '../types'
import { AccountPage } from './AccountPage'

const account = '0x0000000000000000000000000000000000000001' as Address

const profile: SocialProfile = {
  displayName: 'Jamie',
  xUsername: 'jamie_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: '',
  exists: true,
}

const snapshot: UserSnapshot = {
  walletUsdc: 312_400_000n,
  appBalance: 124_500_000n,
  pendingBonus: 0n,
  bonusPaidTo: 0n,
  repScore: 82n,
  allowance: 0n,
  friendCount: 4n,
  friends: [],
  challenges: [],
  recentActivity: [],
  socialProfile: profile,
}

const config = { stakeAmt: 10_000_000n } as ContractConfig

afterEach(cleanup)

type AccountPageProps = Parameters<typeof AccountPage>[0]

function setup(overrides: Partial<AccountPageProps> = {}) {
  const props: AccountPageProps = {
    account,
    isConnected: true,
    isOwner: false,
    snapshot,
    config,
    onConnect: vi.fn(),
    onEditProfile: vi.fn(),
    onShowQr: vi.fn(),
    onOpenWallet: vi.fn(),
    onOpenAdmin: vi.fn(),
    onOpenTerms: vi.fn(),
    onSwitchNetwork: vi.fn(),
    onDisconnect: vi.fn(),
    ...overrides,
  }
  render(<AccountPage {...props} />)
  return props
}

describe('AccountPage (self control centre)', () => {
  it('separates the app balance from the wallet balance and names both in USDC', () => {
    setup()
    expect(screen.getByText('SocialTrust app balance')).toBeTruthy()
    expect(screen.getByText('124.50 USDC')).toBeTruthy()
    expect(screen.getByText('Wallet USDC')).toBeTruthy()
    expect(screen.getByText('312.40 USDC')).toBeTruthy()
    // Money is never relabelled as a trust score.
    expect(screen.queryByText(/Trust Balance/i)).toBeNull()
  })

  it('shows reputation and friend count as the key stats', () => {
    setup()
    const stats = screen.getByLabelText('Key stats')
    expect(stats.textContent).toContain('Reputation')
    expect(stats.textContent).toContain('82')
    expect(stats.textContent).toContain('Friends')
    expect(stats.textContent).toContain('4')
  })

  it('opens the funds sheet on the tab that matches the action', async () => {
    const { onOpenWallet } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Deposit/ }))
    expect(onOpenWallet).toHaveBeenCalledWith('deposit')
    await userEvent.click(screen.getByRole('button', { name: /Withdraw/ }))
    expect(onOpenWallet).toHaveBeenCalledWith('withdraw')
  })

  it('shows the stored public profile fields and never claims they are verified', () => {
    setup()
    expect(screen.getByText('@jamie_x')).toBeTruthy()
    expect(screen.getByText('@jamietg')).toBeTruthy()
    expect(screen.getByText('@jamie.discord')).toBeTruthy()
    expect(screen.queryByText(/verified/i)).toBeNull()
    expect(screen.getByText(/does not verify/i)).toBeTruthy()
  })

  it('hides the allowance row when the allowance already covers a stake', () => {
    setup({ snapshot: { ...snapshot, allowance: 999_000_000n } })
    expect(screen.queryByText('USDC allowance')).toBeNull()
  })

  it('shows the network exactly once, in the section that can act on it', () => {
    setup()
    // Funds owns Network because that row carries the wrong-network state and
    // the switch action; the Account section must not repeat it.
    expect(screen.getAllByText('Network')).toHaveLength(1)
    const accountSection = screen.getByText('Account', { selector: '.sectionTitle' }).closest('section')!
    expect(accountSection.textContent).not.toContain('Network')
    expect(accountSection.textContent).toContain('Connected wallet')
    expect(accountSection.textContent).toContain('Protocol terms')
  })

  it('shows admin controls only for the contract owner', async () => {
    const { onOpenAdmin } = setup({ isOwner: true })
    await userEvent.click(screen.getByRole('button', { name: /Admin controls/ }))
    expect(onOpenAdmin).toHaveBeenCalledOnce()

    cleanup()
    setup({ isOwner: false })
    expect(screen.queryByText('Admin controls')).toBeNull()
  })

  it('exposes edit profile, QR sharing, and disconnect', async () => {
    const { onEditProfile, onShowQr, onDisconnect } = setup()
    await userEvent.click(screen.getAllByRole('button', { name: /Edit profile/ })[0])
    expect(onEditProfile).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Show my QR/ }))
    expect(onShowQr).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: /Disconnect wallet/ }))
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('offers a network switch only when the wallet is on the wrong chain', async () => {
    const { onSwitchNetwork } = setup({ wrongNetwork: true })
    await userEvent.click(screen.getAllByRole('button', { name: /Network/ })[0])
    expect(onSwitchNetwork).toHaveBeenCalledOnce()
  })

  it('asks for a wallet before showing any account data', () => {
    setup({ isConnected: false, account: undefined })
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeTruthy()
    expect(screen.queryByText('SocialTrust app balance')).toBeNull()
  })
})
