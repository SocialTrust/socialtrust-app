// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { SocialProfile } from '../types'
import { ProfileEditSheet } from '../components/ProfileEditSheet'

const account = '0x0000000000000000000000000000000000000001' as Address
const contractAddress = '0x00000000000000000000000000000000000000bb' as Address
const profilesAddress = '0x00000000000000000000000000000000000000aa' as Address

const readContract = vi.fn()
const waitForTransactionReceipt = vi.fn()
const getBlockNumber = vi.fn(async () => 200n)
const writeContract = vi.fn()

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
      isConfigured: true,
      configProblems: [],
      hasProfiles: true,
      graphEnabled: false,
      graphUrl: '',
    },
  }
})

const { useSocialTrust } = await import('./useSocialTrust')

const ALLOWED = 'https://pbs.twimg.com/profile_images/1234567890/avatar_400x400.jpg'

const storedProfile: SocialProfile = {
  displayName: 'Jamie',
  xUsername: 'jamie_x',
  telegramUsername: 'jamietg',
  discordUsername: 'jamie.discord',
  imgUrl: '',
  exists: true,
}

function valuesWith(imgUrl: string) {
  return {
    displayName: storedProfile.displayName,
    xUsername: storedProfile.xUsername,
    telegramUsername: storedProfile.telegramUsername,
    discordUsername: storedProfile.discordUsername,
    imgUrl,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  writeContract.mockResolvedValue('0xhash')
  waitForTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 123n })
  getBlockNumber.mockImplementation(async () => 200n)
  readContract.mockImplementation(async (params: { address: Address; functionName: string }) => {
    if (params.address === profilesAddress) {
      return params.functionName === 'getProfiles' ? [] : storedProfile
    }
    if (params.functionName === 'owner') return account
    if (params.functionName === 'isInMatchQueue') return false
    return 0n
  })
})

afterEach(cleanup)

async function renderLoadedHook() {
  const view = renderHook(() => useSocialTrust())
  await waitFor(() => expect(view.result.current.snapshot).toBeDefined())
  return view
}

describe('profile image restriction on save', () => {
  it('saves an X/Twitter image URL', async () => {
    const { result } = await renderLoadedHook()

    let saved: unknown
    await act(async () => { saved = await result.current.actions.setProfile(valuesWith(ALLOWED)) })

    expect(saved).toBe(true)
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'setProfile',
        args: ['Jamie', 'jamie_x', 'jamietg', 'jamie.discord', ALLOWED],
      }),
    )
  })

  it('saves an empty image URL, which clears the image', async () => {
    const { result } = await renderLoadedHook()

    let saved: unknown
    await act(async () => { saved = await result.current.actions.setProfile(valuesWith('')) })

    expect(saved).toBe(true)
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['Jamie', 'jamie_x', 'jamietg', 'jamie.discord', ''] }),
    )
  })

  it.each([
    ['another host', 'https://example.com/a.png'],
    ['a look-alike host', 'https://pbs.twimg.com.evil.com/profile_images/1/a.jpg'],
    ['a subdomain of the allowed host', 'https://a.pbs.twimg.com/profile_images/1/a.jpg'],
    ['plain http', 'http://pbs.twimg.com/profile_images/1/a.jpg'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['a path outside /profile_images/', 'https://pbs.twimg.com/media/1/a.jpg'],
    ['a malformed URL', 'not a url'],
  ])('refuses %s without sending a transaction', async (_label, imgUrl) => {
    const { result } = await renderLoadedHook()

    let saved: unknown
    await act(async () => { saved = await result.current.actions.setProfile(valuesWith(imgUrl)) })

    // Falsy, so the editing sheet stays open on the user's input.
    expect(saved).toBeFalsy()
    expect(writeContract).not.toHaveBeenCalled()
    expect(result.current.tx.error).toMatch(/pbs\.twimg\.com\/profile_images\//)
    expect(result.current.tx.error).toMatch(/blank/)
  })
})

describe('profile sheet closing behaviour', () => {
  async function editImage(imgUrl: string) {
    const input = await screen.findByLabelText('Profile image URL')
    await userEvent.clear(input)
    await userEvent.type(input, imgUrl)
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
  }

  it('stays open when the save is refused, preserving the entered value', async () => {
    const { result } = await renderLoadedHook()
    const onClose = vi.fn()
    render(
      <ProfileEditSheet
        open
        loadProfile={async () => storedProfile}
        onClose={onClose}
        onSave={result.current.actions.setProfile}
      />,
    )

    await editImage('https://example.com/a.png')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('https://example.com/a.png')).toBeTruthy()
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('closes once the save returns true', async () => {
    const { result } = await renderLoadedHook()
    const onClose = vi.fn()
    render(
      <ProfileEditSheet
        open
        loadProfile={async () => storedProfile}
        onClose={onClose}
        onSave={result.current.actions.setProfile}
      />,
    )

    await editImage(ALLOWED)

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(writeContract).toHaveBeenCalledOnce()
  })
})
