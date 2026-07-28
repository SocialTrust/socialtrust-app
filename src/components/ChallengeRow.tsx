import type { Address } from 'viem'
import type { ChallengeView, SocialProfile } from '../types'
import type { ChallengeState } from '../types'
import { getChallengeState, stateLabel } from '../lib/challenges'
import { countdownUntil, formatUsdc } from '../lib/format'
import { ProfileAvatar, displayNameFor } from './ProfileAvatar'

// Short pill labels keep the row's first line readable on a 360px screen. The
// full wording from stateLabel() is still used in the challenge detail sheet.
const PILL_LABELS: Record<ChallengeState, string> = {
  'ready-finalize': 'Finalize',
  'pending-incoming': 'Invite',
  'steal-open': 'Steal open',
  'active-safe': 'Active',
  'pending-outgoing': 'Waiting',
  unknown: 'Unknown',
}

type ChallengeRowProps = {
  challenge: ChallengeView
  profile?: SocialProfile
  /** Drives the accept label: an app balance below the stake deposits first. */
  appBalance?: bigint
  nowSeconds: number
  busy?: boolean
  onOpen: (challenge: ChallengeView) => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onNavigateAccount: (address: Address) => void
}

function detailFor(challenge: ChallengeView, nowSeconds: number) {
  const state = getChallengeState(challenge, nowSeconds)
  const stake = `${formatUsdc(challenge.stakeAmount)} USDC`

  switch (state) {
    case 'ready-finalize':
      return `Timer finished · get back ${formatUsdc(challenge.stakeAmount - (challenge.friendshipSuccessFee ?? 0n))} USDC`
    case 'pending-incoming':
      return `Wants to start a friendship · ${stake} stake`
    case 'steal-open':
      return `Steal window open · finalizes in ${countdownUntil(challenge.challengeEndsAt, nowSeconds)}`
    case 'active-safe':
      return `Steal opens in ${countdownUntil(challenge.stealAllowedAt, nowSeconds)} · ${stake} staked`
    case 'pending-outgoing':
      return `Waiting for them to stake · cancel fee ${formatUsdc(challenge.cancelPendingStakeFee)} USDC`
    default:
      return `${stake} stake`
  }
}

export function ChallengeRow({
  challenge,
  profile,
  appBalance,
  nowSeconds,
  busy,
  onOpen,
  onFinalize,
  onAccept,
  onReject,
  onCancel,
  onNavigateAccount,
}: ChallengeRowProps) {
  const state = getChallengeState(challenge, nowSeconds)
  const name = displayNameFor(challenge.other, profile)
  const needsDeposit = appBalance !== undefined && appBalance < challenge.stakeAmount

  return (
    <article className={`challengeRow challengeRow-${state}`}>
      <button
        className="challengeRowMain"
        type="button"
        onClick={() => onOpen(challenge)}
        aria-label={`Open challenge with ${name}`}
      >
        <ProfileAvatar address={challenge.other} profile={profile} size="sm" />
        <span className="challengeRowCopy">
          <span className="challengeRowTopLine">
            <strong>{name}</strong>
            <span className={`statePill statePill-${state}`} title={stateLabel(state)}>{PILL_LABELS[state]}</span>
          </span>
          <span className="challengeRowDetail">{detailFor(challenge, nowSeconds)}</span>
        </span>
      </button>

      <div className="challengeRowActions">
        {state === 'ready-finalize' ? (
          <button className="primaryButton small" type="button" disabled={busy} onClick={() => onFinalize(challenge)}>Finalize</button>
        ) : null}

        {state === 'pending-incoming' ? (
          <>
            <button className="primaryButton small" type="button" disabled={busy} onClick={() => onAccept(challenge)}>
              {needsDeposit ? 'Deposit & stake' : 'Accept'}
            </button>
            <button className="ghostButton small" type="button" disabled={busy} onClick={() => onReject(challenge)}>Reject</button>
          </>
        ) : null}

        {state === 'pending-outgoing' ? (
          <button className="ghostButton small" type="button" disabled={busy} onClick={() => onCancel(challenge)}>Cancel invite</button>
        ) : null}

        {state === 'steal-open' ? (
          <button className="dangerButton small" type="button" disabled={busy} onClick={() => onOpen(challenge)}>Steal pot</button>
        ) : null}

        <button
          className="linkButton"
          type="button"
          onClick={() => onNavigateAccount(challenge.other)}
        >
          View profile
        </button>
      </div>
    </article>
  )
}
