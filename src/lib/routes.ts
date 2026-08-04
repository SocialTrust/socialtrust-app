import type { Address } from 'viem'
import { isAddressLike } from './format'

export type TabKey = 'home' | 'friends' | 'activity' | 'account'

export type Route =
  | { name: 'home' }
  | { name: 'friends' }
  | { name: 'activity' }
  | { name: 'me' }
  | { name: 'account'; address: Address }
  | { name: 'not-found' }

export const TAB_PATHS: Record<TabKey, string> = {
  home: '/',
  friends: '/friends',
  activity: '/activity',
  account: '/me',
}

/** Trailing slashes and empty paths resolve to the same destination as `/`. */
function normalizePath(path: string) {
  const clean = (path || '/').split('?')[0].split('#')[0]
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
  return clean || '/'
}

export function parseRoute(path: string): Route {
  const clean = normalizePath(path)

  if (clean === '/') return { name: 'home' }
  if (clean === '/friends') return { name: 'friends' }
  if (clean === '/activity') return { name: 'activity' }
  if (clean === '/me') return { name: 'me' }

  const match = clean.match(/^\/account\/(0x[a-fA-F0-9]{40})$/)
  if (match && isAddressLike(match[1])) return { name: 'account', address: match[1] as Address }

  return { name: 'not-found' }
}

/**
 * Which bottom tab is highlighted for a route. Public profiles are reached
 * through the Friends area, so `/account/:address` keeps Friends selected
 * rather than leaving the bar with no active item.
 */
export function tabForRoute(route: Route): TabKey | undefined {
  switch (route.name) {
    case 'home': return 'home'
    case 'friends': return 'friends'
    case 'activity': return 'activity'
    case 'me': return 'account'
    case 'account': return 'friends'
    default: return undefined
  }
}
