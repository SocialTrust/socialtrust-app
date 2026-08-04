import { describe, expect, it } from 'vitest'
import { isAllowedProfileImageUrl, profileImageSrc } from './profileImage'

const VALID = 'https://pbs.twimg.com/profile_images/1234567890/avatar_400x400.jpg'

describe('isAllowedProfileImageUrl', () => {
  it('accepts X/Twitter profile image URLs', () => {
    expect(isAllowedProfileImageUrl(VALID)).toBe(true)
    expect(isAllowedProfileImageUrl('https://pbs.twimg.com/profile_images/1/a_normal.png')).toBe(true)
    // Query strings and fragments do not change the host or path prefix.
    expect(isAllowedProfileImageUrl(`${VALID}?format=jpg&name=small`)).toBe(true)
    // The URL parser lowercases the scheme and host.
    expect(isAllowedProfileImageUrl('HTTPS://PBS.TWIMG.COM/profile_images/1/a.jpg')).toBe(true)
    // Surrounding whitespace is trimmed before parsing.
    expect(isAllowedProfileImageUrl(`  ${VALID}  `)).toBe(true)
  })

  it('accepts an empty value, which means no image', () => {
    expect(isAllowedProfileImageUrl('')).toBe(true)
    expect(isAllowedProfileImageUrl('   ')).toBe(true)
    expect(isAllowedProfileImageUrl(undefined)).toBe(true)
  })

  it('rejects look-alike hosts', () => {
    // The whole point of comparing hostname exactly rather than matching a
    // substring or a prefix.
    expect(isAllowedProfileImageUrl('https://pbs.twimg.com.evil.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://evil.com/pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://evilpbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://notpbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://abs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://evil.com/?x=https://pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    // A subdomain of the allowed host is still not the allowed host.
    expect(isAllowedProfileImageUrl('https://a.pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
  })

  it('rejects other protocols', () => {
    expect(isAllowedProfileImageUrl('http://pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('ftp://pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedProfileImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false)
    expect(isAllowedProfileImageUrl('//pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
  })

  it('rejects paths outside /profile_images/', () => {
    expect(isAllowedProfileImageUrl('https://pbs.twimg.com/media/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://pbs.twimg.com/')).toBe(false)
    expect(isAllowedProfileImageUrl('https://pbs.twimg.com/profile_imagesX/1/a.jpg')).toBe(false)
    // Traversal is normalized away by the parser before the prefix is checked.
    expect(isAllowedProfileImageUrl('https://pbs.twimg.com/profile_images/../media/a.jpg')).toBe(false)
  })

  it('rejects malformed URLs instead of throwing', () => {
    expect(isAllowedProfileImageUrl('not a url')).toBe(false)
    expect(isAllowedProfileImageUrl('pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://')).toBe(false)
    expect(isAllowedProfileImageUrl('://pbs.twimg.com/profile_images/1/a.jpg')).toBe(false)
    expect(isAllowedProfileImageUrl('https://pbs.twimg .com/profile_images/1/a.jpg')).toBe(false)
  })
})

describe('profileImageSrc', () => {
  it('returns the trimmed URL for an allowed image', () => {
    expect(profileImageSrc(`  ${VALID} `)).toBe(VALID)
  })

  it('returns undefined when there is nothing renderable', () => {
    // Empty is allowed to save but there is no image to render.
    expect(profileImageSrc('')).toBeUndefined()
    expect(profileImageSrc(undefined)).toBeUndefined()
  })

  it('returns undefined for a stored URL that would not pass validation', () => {
    // Profiles written before this rule, or by another client, must not be
    // rendered just because they are already on chain.
    expect(profileImageSrc('https://example.com/a.png')).toBeUndefined()
    expect(profileImageSrc('https://pbs.twimg.com.evil.com/profile_images/1/a.jpg')).toBeUndefined()
    expect(profileImageSrc('http://pbs.twimg.com/profile_images/1/a.jpg')).toBeUndefined()
  })

  it('agrees with the validator on every case', () => {
    const cases = [
      VALID,
      'https://example.com/a.png',
      'http://pbs.twimg.com/profile_images/1/a.jpg',
      'https://pbs.twimg.com.evil.com/profile_images/1/a.jpg',
      'not a url',
    ]
    for (const value of cases) {
      // A renderable URL is always a savable one; the reverse only differs for
      // the empty value, which is savable but has nothing to render.
      if (profileImageSrc(value)) expect(isAllowedProfileImageUrl(value)).toBe(true)
      else if (value.trim()) expect(isAllowedProfileImageUrl(value)).toBe(false)
    }
  })
})
