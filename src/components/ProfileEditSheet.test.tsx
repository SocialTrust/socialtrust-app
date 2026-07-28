// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileEditSheet } from './ProfileEditSheet'
import type { SocialProfile } from '../types'

const profile: SocialProfile = {
  displayName: 'Jamie',
  xUsername: 'old_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: 'https://example.com/a.png',
  exists: true,
}

afterEach(cleanup)

function setup(onSave = vi.fn(async () => true), loadProfile = vi.fn(async () => profile)) {
  const onClose = vi.fn()
  render(<ProfileEditSheet open loadProfile={loadProfile} onClose={onClose} onSave={onSave} />)
  return { onClose, onSave, loadProfile }
}

describe('ProfileEditSheet', () => {
  it('loads and prepopulates the visible current profile, with no Discord UI', async () => {
    setup()
    expect(screen.getByText('loading profile...')).toBeTruthy()
    expect(await screen.findByDisplayValue('Jamie')).toBeTruthy()
    expect(screen.getByDisplayValue('old_x')).toBeTruthy()
    expect(screen.getByDisplayValue('jamietg')).toBeTruthy()
    expect(screen.getByDisplayValue('https://example.com/a.png')).toBeTruthy()
    expect(screen.queryByText(/Discord/i)).toBeNull()
    expect((screen.getByRole('button', { name: 'Save profile' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('saves one edited field with every other field, including hidden Discord, preserved', async () => {
    const { onSave } = setup()
    const xInput = await screen.findByLabelText('X username')
    await userEvent.clear(xInput)
    await userEvent.type(xInput, 'new_x')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(onSave).toHaveBeenCalledWith({
      displayName: 'Jamie',
      xUsername: 'new_x',
      telegramUsername: 'jamietg',
      discordUsername: 'jamie.discord',
      imgUrl: 'https://example.com/a.png',
    })
  })

  it('does not expose an editable blank profile when loading fails and supports retry', async () => {
    const loadProfile = vi.fn().mockRejectedValueOnce(new Error('RPC failed')).mockResolvedValueOnce(profile)
    setup(undefined, loadProfile)
    expect(await screen.findByText('Could not load your profile. Try again.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByDisplayValue('Jamie')).toBeTruthy()
  })

  it('preserves edits and stays open when saving fails, then closes only after success', async () => {
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const { onClose } = setup(onSave)
    const input = await screen.findByLabelText('Display name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Jamie Updated')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Jamie Updated')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('prevents duplicate submissions and closing while a save is pending', async () => {
    let resolve!: (success: boolean) => void
    const onSave = vi.fn(() => new Promise<boolean>((done) => { resolve = done }))
    const { onClose } = setup(onSave)
    const input = await screen.findByLabelText('Display name')
    await userEvent.type(input, ' X')
    const form = screen.getByRole('button', { name: 'Save profile' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(onSave).toHaveBeenCalledOnce()
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
    expect(onClose).not.toHaveBeenCalled()
    resolve(true)
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})
