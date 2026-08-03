/**
 * Profile images are restricted to the Twitter/X avatar CDN.
 *
 * The profiles contract stores whatever string it is given, so the restriction
 * has to hold in the client — and it has to hold in both directions: the same
 * predicate decides whether a URL may be saved and whether a stored URL may be
 * rendered. Validating only on save would leave every profile written before
 * this rule (or by any other client) free to point an <img> at an arbitrary
 * host, which leaks each viewer's IP and request headers to that host.
 */

export const PROFILE_IMAGE_HOST = 'pbs.twimg.com'
export const PROFILE_IMAGE_PATH_PREFIX = '/profile_images/'

export const PROFILE_IMAGE_ERROR =
  `Profile image must be an X/Twitter image link starting https://${PROFILE_IMAGE_HOST}${PROFILE_IMAGE_PATH_PREFIX} — or leave it blank for the default avatar.`

/**
 * True for an empty value (no image, which is always allowed) or for a URL on
 * the permitted host.
 *
 * Parsing with `new URL` rather than string matching is what makes this safe:
 * `hostname` is compared exactly, so `pbs.twimg.com.evil.com` and
 * `evil.com/pbs.twimg.com/...` both fail, and the parser normalizes `..`
 * segments before the path prefix is checked. A string that does not parse is
 * rejected rather than thrown.
 */
export function isAllowedProfileImageUrl(value?: string): boolean {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return true

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return false
  }

  return (
    url.protocol === 'https:' &&
    url.hostname === PROFILE_IMAGE_HOST &&
    url.pathname.startsWith(PROFILE_IMAGE_PATH_PREFIX)
  )
}

/**
 * The URL to render, or undefined when there is nothing renderable. An empty
 * value and a disallowed value both fall back to the default avatar.
 */
export function profileImageSrc(value?: string): string | undefined {
  const trimmed = (value ?? '').trim()
  if (!trimmed || !isAllowedProfileImageUrl(trimmed)) return undefined
  return trimmed
}
