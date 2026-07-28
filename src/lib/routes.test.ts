import { describe, expect, it } from 'vitest'
import { parseRoute, tabForRoute, TAB_PATHS } from './routes'

const address = '0x1111111111111111111111111111111111111111'

describe('route parsing', () => {
  it('resolves the four top-level destinations', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' })
    expect(parseRoute('/friends')).toEqual({ name: 'friends' })
    expect(parseRoute('/activity')).toEqual({ name: 'activity' })
    expect(parseRoute('/me')).toEqual({ name: 'me' })
  })

  it('resolves a public profile route', () => {
    expect(parseRoute(`/account/${address}`)).toEqual({ name: 'account', address })
  })

  it('ignores trailing slashes, query strings, and hashes', () => {
    expect(parseRoute('/friends/')).toEqual({ name: 'friends' })
    expect(parseRoute('/activity?ref=x')).toEqual({ name: 'activity' })
    expect(parseRoute('/me#top')).toEqual({ name: 'me' })
    expect(parseRoute('')).toEqual({ name: 'home' })
  })

  it('rejects malformed accounts and unknown paths', () => {
    expect(parseRoute('/account/0xnope')).toEqual({ name: 'not-found' })
    expect(parseRoute('/account')).toEqual({ name: 'not-found' })
    expect(parseRoute('/settings')).toEqual({ name: 'not-found' })
  })
})

describe('bottom tab selection', () => {
  it('selects the matching tab for each destination', () => {
    expect(tabForRoute(parseRoute('/'))).toBe('home')
    expect(tabForRoute(parseRoute('/friends'))).toBe('friends')
    expect(tabForRoute(parseRoute('/activity'))).toBe('activity')
    expect(tabForRoute(parseRoute('/me'))).toBe('account')
  })

  it('keeps Friends selected on a public profile, which is reached from Friends', () => {
    expect(tabForRoute(parseRoute(`/account/${address}`))).toBe('friends')
  })

  it('selects no tab for an unknown route', () => {
    expect(tabForRoute(parseRoute('/nope'))).toBeUndefined()
  })

  it('maps every tab to its canonical path', () => {
    expect(TAB_PATHS).toEqual({ home: '/', friends: '/friends', activity: '/activity', account: '/me' })
  })
})
