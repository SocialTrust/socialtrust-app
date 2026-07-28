import { useState } from 'react'
import type { Address } from 'viem'
import type { ChallengeView, SocialProfile } from '../types'
import { countdownUntil, formatUsdc, shortAddress, timestampToDate } from '../lib/format'
import { getChallengeState, stateLabel } from '../lib/challenges'
import { Sheet } from './Sheet'
import { ProfileAvatar, displayNameFor } from './ProfileAvatar'

type ChallengeDetailSheetProps = {
  challenge?: ChallengeView
  profile?: SocialProfile
  /** Below the stake, accepting deposits the shortfall first. */
  appBalance?: bigint
  onClose: () => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onSteal: (challenge: ChallengeView) => void
  onNavigateAccount: (address: Address) => void
  nowSeconds: number
}

export function ChallengeDetailSheet({
  challenge,
  profile,
  appBalance,
  onClose,
  onFinalize,
  onAccept,
  onReject,
  onCancel,
  onSteal,
  onNavigateAccount,
  nowSeconds,
}: ChallengeDetailSheetProps) {
  const [submitting, setSubmitting] = useState(false)
  const state = challenge ? getChallengeState(challenge, nowSeconds) : 'unknown'
  const pot = challenge ? challenge.stakeAmount * 2n : 0n
  const treasury = challenge ? pot - challenge.stealBounty : 0n
  const refundPerUser = challenge ? challenge.stakeAmount - (challenge.friendshipSuccessFee ?? 0n) : 0n
  const needsDeposit = Boolean(challenge && appBalance !== undefined && appBalance < challenge.stakeAmount)

  // The action itself is owned by the caller; this only stops a second tap from
  // firing a duplicate wallet prompt while the first is in flight.
  const run = (action: (challenge: ChallengeView) => void) => () => {
    if (!challenge || submitting) return
    setSubmitting(true)
    try {
      action(challenge)
    } finally {
      window.setTimeout(() => setSubmitting(false), 400)
    }
  }

  const footer = challenge ? (
    <>
      {state === 'ready-finalize' ? (
        <button className="primaryButton full" type="button" disabled={submitting} onClick={run(onFinalize)}>Finalize friendship</button>
      ) : null}
      {state === 'pending-incoming' ? (
        <>
          <button className="primaryButton full" type="button" disabled={submitting} onClick={run(onAccept)}>
            {needsDeposit ? `Deposit & stake ${formatUsdc(challenge.stakeAmount)} USDC` : `Accept & stake ${formatUsdc(challenge.stakeAmount)} USDC`}
          </button>
          <button className="ghostButton full" type="button" disabled={submitting} onClick={run(onReject)}>Reject invite</button>
        </>
      ) : null}
      {state === 'pending-outgoing' ? (
        <button className="ghostButton full" type="button" disabled={submitting} onClick={run(onCancel)}>Cancel pending invite</button>
      ) : null}
      {state === 'steal-open' ? (
        <button className="dangerButton full" type="button" disabled={submitting} onClick={run(onSteal)}>Steal pot</button>
      ) : null}
    </>
  ) : null

  return (
    <Sheet
      open={Boolean(challenge)}
      title="Challenge details"
      description={challenge ? stateLabel(state) : undefined}
      onClose={onClose}
      footer={footer}
    >
      {challenge ? (
        <div className="formStack">
          <button
            className="detailIdentity"
            type="button"
            onClick={() => onNavigateAccount(challenge.other)}
            aria-label={`Open ${displayNameFor(challenge.other, profile)}`}
          >
            <ProfileAvatar address={challenge.other} profile={profile} size="md" />
            <span>
              <strong>{displayNameFor(challenge.other, profile)}</strong>
              <small>{shortAddress(challenge.other, 6)}</small>
            </span>
            <span className={`statePill statePill-${state}`}>{stateLabel(state)}</span>
          </button>

          <p className="quietCaption">
            {challenge.challengeEndsAt !== 0n
              ? `Finalizes in ${countdownUntil(challenge.challengeEndsAt, nowSeconds)}`
              : 'Waiting for both people to stake.'}
          </p>

          <dl className="factList">
            <div><dt>Stake each</dt><dd>{formatUsdc(challenge.stakeAmount)} USDC</dd></div>
            <div><dt>Steal bounty</dt><dd>{formatUsdc(challenge.stealBounty)} USDC</dd></div>
            <div><dt>Success fee</dt><dd>{formatUsdc(challenge.friendshipSuccessFee)} USDC</dd></div>
            <div><dt>Steal opens</dt><dd>{timestampToDate(challenge.stealAllowedAt)}</dd></div>
            <div><dt>Finalizes</dt><dd>{timestampToDate(challenge.challengeEndsAt)}</dd></div>
          </dl>

          <section className="timeline">
            <h3>Timeline</h3>
            <ol>
              <li className={challenge.userStaked ? 'done' : ''}><span aria-hidden="true" />You staked</li>
              <li className={challenge.otherStaked ? 'done' : ''}><span aria-hidden="true" />They staked</li>
              <li className={state === 'steal-open' || state === 'ready-finalize' ? 'done' : ''}><span aria-hidden="true" />Steal window</li>
              <li className={state === 'ready-finalize' ? 'done' : ''}><span aria-hidden="true" />Finalize friendship</li>
            </ol>
          </section>

          <section className="explainBlock">
            <h3>Outcomes</h3>
            <p><strong>If nobody steals:</strong> each person gets back {formatUsdc(refundPerUser)} USDC, the friendship is recorded, and bonuses may be paid.</p>
            <p><strong>If someone steals:</strong> the thief receives {formatUsdc(challenge.stealBounty)} USDC, {formatUsdc(treasury)} USDC goes to the rewards pool, and the friendship fails.</p>
          </section>
        </div>
      ) : null}
    </Sheet>
  )
}
