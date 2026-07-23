import type { ChallengeState, ChallengeView } from '../types'

export function getChallengeState(challenge: ChallengeView, nowSeconds = Math.floor(Date.now() / 1000)): ChallengeState {
  const now = BigInt(nowSeconds)

  if (!challenge.userStaked && challenge.otherStaked && challenge.challengeStartedAt === 0n) return 'pending-incoming'
  if (challenge.userStaked && !challenge.otherStaked && challenge.challengeStartedAt === 0n) return 'pending-outgoing'
  if (challenge.challengeStartedAt !== 0n && now >= challenge.challengeEndsAt) return 'ready-finalize'
  if (challenge.active && now >= challenge.stealAllowedAt) return 'steal-open'
  if (challenge.active) return 'active-safe'
  return 'unknown'
}

export function challengeSortScore(challenge: ChallengeView, nowSeconds = Math.floor(Date.now() / 1000)) {
  const state = getChallengeState(challenge, nowSeconds)
  const order: Record<ChallengeState, number> = {
    'ready-finalize': 1,
    'pending-incoming': 2,
    'steal-open': 3,
    'pending-outgoing': 4,
    'active-safe': 5,
    unknown: 6,
  }
  return order[state]
}

export function lockedAmount(challenges: ChallengeView[]) {
  return challenges.reduce((total, challenge) => (challenge.userStaked ? total + challenge.stakeAmount : total), 0n)
}

export function stateLabel(state: ChallengeState) {
  switch (state) {
    case 'ready-finalize': return 'Ready to finalize'
    case 'pending-incoming': return 'Invite received'
    case 'pending-outgoing': return 'Waiting on them'
    case 'steal-open': return 'Steal window open'
    case 'active-safe': return 'Active'
    default: return 'Unknown'
  }
}

export function isAttentionState(state: ChallengeState) {
  return state === 'ready-finalize' || state === 'pending-incoming' || state === 'steal-open' || state === 'pending-outgoing'
}
