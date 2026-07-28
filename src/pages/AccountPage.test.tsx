// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { AccountProfile, SocialProfile } from '../types'
import { AccountPage } from './AccountPage'

const address = '0x0000000000000000000000000000000000000001' as Address

const savedProfile: SocialProfile = {
  displayName: 'Jamie',
  xUsername: 'old_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: '',
  exists: true,
}

const updatedProfile: SocialProfile = { ...savedProfile, displayName: 'Jamie Updated', xUsername: 'new_x' }

const accountProfile: AccountProfile = {
  address,
  friendCount: 0n,
  challengeCount: 0n,
  repScore: 7n,
  pendingBonus: 0n,
  bonusPaidTo: 0n,
  friends: [],
  challenges: [],
  appBalance: 1_000_000n,
  socialProfile: savedProfile,
}

afterEach(cleanup)

function setup(onSetProfile = vi.fn(async () => true), postSaveReadFails = false) {
  // The on-chain profile the strict reader serves; the save flips it, exactly
  // like a confirmed setProfile transaction would.
  let onChainProfile = savedProfile
  let reads = 0
  const readAccountProfile = vi.fn(async () => ({ ...accountProfile, socialProfile: onChainProfile }))
  const readSocialProfile = vi.fn(async () => {
    reads += 1
    if (postSaveReadFails && reads > 1) throw new Error('RPC failed')
    return onChainProfile
  })
  const setProfile = vi.fn(async (values: { displayName: string; xUsername: string }) => {
    const success = await onSetProfile()
    if (success) onChainProfile = { ...onChainProfile, ...values }
    return success
  })

  render(
    <AccountPage
      address={address}
      connectedAccount={address}
      isConnected
      readAccountProfile={readAccountProfile}
      readSocialProfile={readSocialProfile}
      onConnect={vi.fn()}
      onBackHome={vi.fn()}
      onStartWith={vi.fn()}
      onOpenChallenge={vi.fn()}
      onOpenWallet={vi.fn()}
      onOpenAdmin={vi.fn()}
      onSetProfile={setProfile}
      onNavigate={vi.fn()}
      nowSeconds={0}
    />,
  )

  return { readAccountProfile, readSocialProfile, setProfile }
}

async function editDisplayName() {
  await userEvent.click(await screen.findByRole('button', { name: /Edit/ }))
  const input = await screen.findByLabelText('Display name')
  await userEvent.clear(input)
  await userEvent.type(input, 'Jamie Updated')
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
}

describe('AccountPage profile save', () => {
  it('updates the visible profile without reloading the whole account', async () => {
    const { readAccountProfile, readSocialProfile } = setup()
    expect(await screen.findByRole('heading', { name: 'Jamie' })).toBeTruthy()
    expect(readAccountProfile).toHaveBeenCalledOnce()

    await editDisplayName()

    expect(await screen.findByRole('heading', { name: 'Jamie Updated' })).toBeTruthy()
    // The profile card reflects the save too, and the sheet closed.
    await waitFor(() => expect(screen.queryByLabelText('Display name')).toBeNull())
    // Only the initial page load reads the whole account: reputation, balances,
    // allowance, friends, challenges, and Graph activity are not refetched.
    expect(readAccountProfile).toHaveBeenCalledOnce()
    // One strict profile read to prepopulate the editor, one after the save.
    expect(readSocialProfile).toHaveBeenCalledTimes(2)
  })

  it('keeps the account untouched when the save fails', async () => {
    const { readAccountProfile, readSocialProfile } = setup(vi.fn(async () => false))
    expect(await screen.findByRole('heading', { name: 'Jamie' })).toBeTruthy()

    await editDisplayName()

    // Modal stays open with the edit preserved, and nothing was refreshed.
    expect(screen.getByDisplayValue('Jamie Updated')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Jamie' })).toBeTruthy()
    expect(readAccountProfile).toHaveBeenCalledOnce()
    expect(readSocialProfile).toHaveBeenCalledOnce()
  })

  it('still closes the editor when the post-save profile read fails', async () => {
    const { readAccountProfile } = setup(vi.fn(async () => true), true)
    expect(await screen.findByRole('heading', { name: 'Jamie' })).toBeTruthy()

    await editDisplayName()

    // The save itself succeeded, so the sheet closes; the page keeps the last
    // known profile rather than falling back to a whole-account reload.
    await waitFor(() => expect(screen.queryByLabelText('Display name')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Jamie' })).toBeTruthy()
    expect(readAccountProfile).toHaveBeenCalledOnce()
  })
})
