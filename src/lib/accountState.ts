import type { Address } from 'viem'
import { sameAddress } from './format'

/**
 * The two rules that decide whether an asynchronous result may still be
 * applied. They are pure so they can be tested directly, rather than only
 * through whichever race happens to be reachable today.
 */

export type RequestIdentity = {
  /** The account the result was fetched for. */
  user: Address
  /** The load it belongs to, when it came from a full snapshot load. */
  requestId?: number
}

/**
 * A result may be applied only if its account is still connected and, for a
 * full load, its request is still the newest. Anything else is stale and must
 * be discarded — on the success, fallback and error paths alike.
 */
export function isCurrentRequest(
  identity: RequestIdentity,
  currentAccount: Address | undefined,
  latestRequestId: number,
): boolean {
  if (!currentAccount || !sameAddress(identity.user, currentAccount)) return false
  return identity.requestId === undefined || identity.requestId === latestRequestId
}

/**
 * The snapshot only when it belongs to `user`.
 *
 * This is what stops a failed Graph query from "preserving" the previous
 * wallet's friends, challenges or activity: an empty list for the right
 * account is correct, another account's list never is.
 */
export function ownedSnapshot<T>(
  snapshot: T | undefined,
  owner: Address | undefined,
  user: Address,
): T | undefined {
  if (!snapshot || !owner || !sameAddress(owner, user)) return undefined
  return snapshot
}
