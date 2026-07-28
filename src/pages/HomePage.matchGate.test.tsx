// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { ContractConfig, SocialProfile, UserSnapshot } from '../types'
import { HomePage } from './HomePage'

const account = '0x0000000000000000000000000000000000000001' as Address

const withTelegram: SocialProfile = {
  displayName: 'Jamie',
  xUsername: 'jamie_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: 'https://example.com/a.png',
  exists: true,
}

const withoutTelegram: SocialProfile = { ...withTelegram, telegramUsername: '' }

const config = {
  stakeAmt: 10_000_000n,
  cancelPendingStakeFee: 0n,
  rejectPendingStakeFee: 0n,
  challengeDuration: 86_400n,
  stealGracePeriod: 3_600n,
  stealBounty: 15_000_000n,
  friendshipSuccessFee: 0n,
  payoutBps: 0n,
  maxTreasurySpendBps: 0n,
  maxBonusPerSuccess: 0n,
  matchFee: 1_000_000n,
  matchTimeLimit: 259_200n,
  maxMatchScan: 10n,
  matchQueueCancelFee: 0n,
  bonusPool: 0n,
  totalBonusPaid: 0n,
} satisfies ContractConfig

// The snapshot deliberately claims a Telegram handle in every test: it must
// never be what authorizes matchmaking.
function snapshotWith(appBalance: bigint): UserSnapshot {
  return {
    walletUsdc: 50_000_000n,
    appBalance,
    pendingBonus: 0n,
    bonusPaidTo: 0n,
    repScore: 0n,
    allowance: 0n,
    friendCount: 0n,
    friends: [],
    challenges: [],
    recentActivity: [],
    socialProfile: withTelegram,
  }
}

afterEach(cleanup)

function setup({
  readSocialProfile,
  appBalance = 5_000_000n,
  onSetProfile = vi.fn(async () => true),
}: {
  readSocialProfile: (account: Address) => Promise<SocialProfile>
  appBalance?: bigint
  onSetProfile?: (values: unknown) => Promise<boolean | void>
}) {
  const onFindMatch = vi.fn()
  const onDepositAndMatchMe = vi.fn()
  const readProfile = vi.fn(readSocialProfile)

  render(
    <HomePage
      account={account}
      isConnected
      config={config}
      snapshot={snapshotWith(appBalance)}
      isLoading={false}
      onConnect={vi.fn()}
      onStartWith={vi.fn()}
      onFindMatch={onFindMatch}
      onDepositAndMatchMe={onDepositAndMatchMe}
      onCancelMatch={vi.fn()}
      readSocialProfile={readProfile}
      onSetProfile={onSetProfile}
      onOpenChallenge={vi.fn()}
      onFinalize={vi.fn()}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onCancel={vi.fn()}
      onNavigate={vi.fn()}
      nowSeconds={0}
    />,
  )

  return { onFindMatch, onDepositAndMatchMe, onSetProfile, readProfile }
}

const findMatch = () => userEvent.click(screen.getByRole('button', { name: 'Find a match' }))
const telegramField = () => screen.queryByLabelText('Telegram username')

describe('matchmaking Telegram gate', () => {
  it('opens the gate instead of matching when the fresh profile has no Telegram handle', async () => {
    const { onFindMatch, onDepositAndMatchMe, readProfile } = setup({
      readSocialProfile: async () => withoutTelegram,
    })

    await findMatch()

    expect(await screen.findByLabelText('Telegram username')).toBeTruthy()
    expect(readProfile).toHaveBeenCalledWith(account)
    // The stale snapshot claims a handle; only the fresh read decides.
    expect(onFindMatch).not.toHaveBeenCalled()
    expect(onDepositAndMatchMe).not.toHaveBeenCalled()
  })

  it('does not let a handle saved earlier in the session bypass a cleared on-chain handle', async () => {
    // Empty on chain, then saved inline, then cleared again from the profile
    // editor — savedHandle is still in React state throughout.
    let onChainProfile = withoutTelegram
    const { onFindMatch, onDepositAndMatchMe, onSetProfile } = setup({
      readSocialProfile: async () => onChainProfile,
      onSetProfile: vi.fn(async () => {
        onChainProfile = { ...withTelegram, telegramUsername: 'jamiehandle' }
        return true
      }),
    })

    await findMatch()
    await userEvent.type(await screen.findByLabelText('Telegram username'), 'jamiehandle')
    await userEvent.click(screen.getByRole('button', { name: 'Save handle' }))

    expect(onSetProfile).toHaveBeenCalledOnce()
    expect(await screen.findByText("Saved @jamiehandle — you're ready to match")).toBeTruthy()

    // The user now clears Telegram from the profile editor.
    onChainProfile = withoutTelegram
    await findMatch()

    expect(await screen.findByLabelText('Telegram username')).toBeTruthy()
    expect(onFindMatch).not.toHaveBeenCalled()
    expect(onDepositAndMatchMe).not.toHaveBeenCalled()
  })

  it('matches when the fresh profile has a stored handle and the balance covers the fee', async () => {
    const { onFindMatch, onDepositAndMatchMe } = setup({
      readSocialProfile: async () => withTelegram,
      appBalance: 5_000_000n,
    })

    await findMatch()

    await waitFor(() => expect(onFindMatch).toHaveBeenCalledOnce())
    expect(onDepositAndMatchMe).not.toHaveBeenCalled()
    expect(telegramField()).toBeNull()
  })

  it('keeps the deposit-shortfall flow when the balance is short', async () => {
    const { onFindMatch, onDepositAndMatchMe } = setup({
      readSocialProfile: async () => withTelegram,
      appBalance: 250_000n,
    })

    await findMatch()

    await waitFor(() => expect(onDepositAndMatchMe).toHaveBeenCalledWith('0.75'))
    expect(onFindMatch).not.toHaveBeenCalled()
  })

  it('fails closed with a retryable message when the profile read throws', async () => {
    const readSocialProfile = vi
      .fn<(account: Address) => Promise<SocialProfile>>()
      .mockRejectedValueOnce(new Error('RPC failed'))
      .mockResolvedValueOnce(withTelegram)
    const { onFindMatch, onDepositAndMatchMe } = setup({ readSocialProfile })

    await findMatch()

    expect(await screen.findByText('Could not load your profile. Try again.')).toBeTruthy()
    expect(onFindMatch).not.toHaveBeenCalled()
    expect(onDepositAndMatchMe).not.toHaveBeenCalled()
    // No gate either: the handle state is unknown, not known to be missing.
    expect(telegramField()).toBeNull()

    // Retrying is all it takes once the RPC recovers.
    await findMatch()
    await waitFor(() => expect(onFindMatch).toHaveBeenCalledOnce())
  })
})
