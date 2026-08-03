import { describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { SocialProfile } from '../types'
import { saveMatchmakingTelegramUsername } from './HomePage'

describe('matchmaking Telegram profile update', () => {
  it('merges Telegram into a strict fresh profile instead of the loaded UI snapshot', async () => {
    const account = '0x0000000000000000000000000000000000000001' as Address
    const loadedUiSnapshot: SocialProfile = {
      displayName: 'Jamie',
      xUsername: 'old_x',
      telegramUsername: 'oldtg',
      discordUsername: 'jamie.discord',
      imgUrl: 'https://pbs.twimg.com/profile_images/1/a.jpg',
      exists: true,
    }
    const freshOnChainProfile = { ...loadedUiSnapshot, xUsername: 'new_x' }
    const readSocialProfile = vi.fn(async () => freshOnChainProfile)
    const setProfile = vi.fn(async () => true)

    await saveMatchmakingTelegramUsername(account, 'newtelegram', readSocialProfile, setProfile)

    expect(readSocialProfile).toHaveBeenCalledWith(account)
    expect(setProfile).toHaveBeenCalledWith({
      displayName: 'Jamie',
      xUsername: 'new_x',
      telegramUsername: 'newtelegram',
      discordUsername: 'jamie.discord',
      imgUrl: 'https://pbs.twimg.com/profile_images/1/a.jpg',
    })
  })

  it('does not write when the strict fresh profile read fails', async () => {
    const account = '0x0000000000000000000000000000000000000001' as Address
    const readSocialProfile = vi.fn(async () => { throw new Error('RPC failed') })
    const setProfile = vi.fn(async () => true)

    await expect(saveMatchmakingTelegramUsername(account, 'newtelegram', readSocialProfile, setProfile)).rejects.toThrow('RPC failed')
    expect(setProfile).not.toHaveBeenCalled()
  })
})
