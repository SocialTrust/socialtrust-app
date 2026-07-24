import type { Address } from 'viem'
import type { ChallengeView, ContractConfig, UserSnapshot } from '../types'
import { countdownUntil, formatUsdc, relativeTime, sameAddress, shortAddress } from '../lib/format'
import { displayNameFor, ProfileAvatar } from './ProfileAvatar'

type MatchmakingCardProps = {
  account?: Address
  config?: ContractConfig
  snapshot?: UserSnapshot
  nowSeconds: number
  txPending?: boolean
  onFindMatch: () => void
  onDepositAndMatchMe: (amount: string) => void
  onCancelMatch: () => void
  onStartWith: (address: Address) => void
  onOpenChallenge: (challenge: ChallengeView) => void
  onNavigateAccount: (address: Address) => void
}

export function MatchmakingCard({
  account,
  config,
  snapshot,
  nowSeconds,
  txPending,
  onFindMatch,
  onDepositAndMatchMe,
  onCancelMatch,
  onStartWith,
  onOpenChallenge,
  onNavigateAccount,
}: MatchmakingCardProps) {
  const activeMatch = snapshot?.activeMatch
  const queueEntry = snapshot?.currentQueueEntry
  const appBalance = snapshot?.appBalance ?? 0n
  const matchFee = config?.matchFee ?? 0n
  const cancelFee = queueEntry?.cancelFeeAmount ?? config?.matchQueueCancelFee ?? 0n
  const hasEnoughBalance = appBalance >= matchFee
  const shortfall = matchFee > appBalance ? matchFee - appBalance : 0n

  // A single "Find a match" button covers both cases: when the app balance
  // already covers the fee it just joins the queue; when it falls short it
  // deposits the difference and joins in one transaction (which, like matchMe,
  // also clears any expired match first). USDC approval is handled inside the
  // write path, exactly as depositAndStakeForFriendship does.
  const findMatchControl = (
    <>
      <button
        className="primaryButton"
        disabled={txPending || matchFee === 0n}
        onClick={() => (hasEnoughBalance ? onFindMatch() : onDepositAndMatchMe(formatUsdc(shortfall)))}
      >
        Find a match
      </button>
      {!hasEnoughBalance ? (
        <small className="matchmakingDepositNote">Deposits {formatUsdc(shortfall)} USDC from your wallet to cover the match fee.</small>
      ) : null}
    </>
  )

  if (activeMatch && account) {
    const partner = sameAddress(activeMatch.user0, account) ? activeMatch.user1 : activeMatch.user0
    const expired = activeMatch.deadline > 0n && BigInt(nowSeconds) > activeMatch.deadline
    const relationshipChallenge = snapshot?.challenges.find((challenge) => sameAddress(challenge.other, partner))

    return (
      <section className={`matchmakingCard ${expired ? 'matchmakingExpired' : 'matchmakingMatched'}`}>
        <div className="matchmakingTopline">
          <span className="eyebrow">Matchmaking</span>
          <span className="matchmakingStatus">{expired ? 'Expired' : 'Matched'}</span>
        </div>

        <button className="matchPartnerRow" onClick={() => onNavigateAccount(partner)}>
          <ProfileAvatar address={partner} profile={snapshot?.matchPartnerProfile} size="sm" />
          <span>
            <strong>{displayNameFor(partner, snapshot?.matchPartnerProfile)}</strong>
            <small>{shortAddress(partner)}</small>
          </span>
        </button>

        {expired ? (
          <>
            <p>Your match window has ended. Clear the expired match before joining matchmaking again.</p>
            {findMatchControl}
          </>
        ) : (
          <>
            <div className="matchmakingFacts">
              <div><span>Time remaining</span><strong>{countdownUntil(activeMatch.deadline, nowSeconds)}</strong></div>
              <div><span>Your match fee</span><strong>{formatUsdc(sameAddress(activeMatch.user0, account) ? activeMatch.feeAmount0 : activeMatch.feeAmount1)} USDC</strong></div>
            </div>
            <p>Complete a friendship with this account before the deadline to get your match fee back.</p>
            {relationshipChallenge ? (
              <button className="primaryButton" disabled={txPending} onClick={() => onOpenChallenge(relationshipChallenge)}>Open friendship challenge</button>
            ) : (
              <button className="primaryButton" disabled={txPending} onClick={() => onStartWith(partner)}>Start friendship</button>
            )}
          </>
        )}
      </section>
    )
  }

  if (queueEntry) {
    const refund = queueEntry.feeAmount > cancelFee ? queueEntry.feeAmount - cancelFee : 0n
    return (
      <section className="matchmakingCard matchmakingQueued">
        <div className="matchmakingTopline">
          <span className="eyebrow">Matchmaking</span>
          <span className="matchmakingStatus">Searching</span>
        </div>
        <h3>Looking for a compatible account</h3>
        <p>Queued {relativeTime(queueEntry.queuedAt, nowSeconds)}. Your {formatUsdc(queueEntry.feeAmount)} USDC match fee is locked while you wait.</p>
        <div className="matchmakingFacts">
          <div><span>Cancel fee</span><strong>{formatUsdc(cancelFee)} USDC</strong></div>
          <div><span>Refund if cancelled</span><strong>{formatUsdc(refund)} USDC</strong></div>
        </div>
        <button className="secondaryButton" disabled={txPending} onClick={onCancelMatch}>Cancel search</button>
      </section>
    )
  }

  return (
    <section className="matchmakingCard">
      <div className="matchmakingTopline">
        <span className="eyebrow">Matchmaking</span>
        <span className="matchmakingStatus">Available</span>
      </div>
      <h3>Meet someone new</h3>
      <p>Join the queue to be paired with a compatible account. Become friends before the match deadline and your match fee is returned.</p>
      <div className="matchmakingFacts">
        <div><span>Match fee</span><strong>{formatUsdc(matchFee)} USDC</strong></div>
        <div><span>Match window</span><strong>{config?.matchTimeLimit ? `${Math.max(1, Math.round(Number(config.matchTimeLimit) / 86400))} days` : '—'}</strong></div>
      </div>
      {findMatchControl}
    </section>
  )
}
