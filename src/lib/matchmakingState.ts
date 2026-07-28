import type { Address } from 'viem'
import type { MatchSnapshot } from '../types'
import { sameAddress } from './format'

export type AccountMatchSnapshot = MatchSnapshot & { account: Address }

export function acceptMatchSnapshot(
  current: AccountMatchSnapshot | undefined,
  next: AccountMatchSnapshot,
  connectedAccount: Address | undefined,
): AccountMatchSnapshot | undefined {
  if (!connectedAccount || !sameAddress(next.account, connectedAccount)) return current
  if (current && sameAddress(current.account, next.account) && next.blockNumber < current.blockNumber) return current
  return next
}

type MatchPollOptions = {
  poll: () => Promise<void>
  shouldContinue: () => boolean
  intervalMs?: number
}

/** Recursive timeout polling: the next RPC read cannot start until the prior one settles. */
export function startMatchPolling({ poll, shouldContinue, intervalMs = 2_000 }: MatchPollOptions) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = () => {
    if (stopped || !shouldContinue()) return
    timer = setTimeout(async () => {
      if (stopped || !shouldContinue()) return
      try {
        await poll()
      } finally {
        schedule()
      }
    }, intervalMs)
  }

  schedule()
  return () => {
    stopped = true
    if (timer !== undefined) clearTimeout(timer)
  }
}
