import type { ChallengeView, ContractConfig } from '../types'
import { countdownUntil, formatUsdc, shortAddress } from '../lib/format'
import { getChallengeState, stateLabel } from '../lib/challenges'

type ChallengeCardProps = {
  challenge: ChallengeView
  config?: ContractConfig
  onOpen: (challenge: ChallengeView) => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onNavigateAccount: (address: string) => void
  nowSeconds: number
}

function copyFor(challenge: ChallengeView, config: ContractConfig | undefined, nowSeconds: number) {
  const state = getChallengeState(challenge, nowSeconds)
  const other = shortAddress(challenge.other)
  const stake = `${formatUsdc(challenge.stakeAmount)} USDC`
  const refund = `${formatUsdc(challenge.stakeAmount - (challenge.friendshipSuccessFee ?? 0n))} USDC`

  switch (state) {
    case 'ready-finalize':
      return {
        tone: 'success',
        label: stateLabel(state),
        title: `You and ${other} made it.`,
        desc: `Get back ${refund} + possible bonus.`,
      }
    case 'pending-incoming':
      return {
        tone: 'invite',
        label: 'Invite',
        title: `${other} wants to start a friendship.`,
        desc: `Stake required: ${stake}.`,
      }
    case 'steal-open':
      return {
        tone: 'danger',
        label: stateLabel(state),
        title: `Your ${stake} stake is at risk with ${other}.`,
        desc: `Finalizes in ${countdownUntil(challenge.challengeEndsAt, nowSeconds)}.`,
      }
    case 'active-safe':
      return {
        tone: 'warning',
        label: 'Active',
        title: `Challenge with ${other}.`,
        desc: `Steal opens in ${countdownUntil(challenge.stealAllowedAt, nowSeconds)}.`,
        metaLeft: `Finalizes in ${countdownUntil(challenge.challengeEndsAt, nowSeconds)}`,
        metaRight: `Stake ${stake}`,
      }
    case 'pending-outgoing':
      return {
        tone: 'waiting',
        label: 'Waiting',
        title: `You staked ${stake} with ${other}.`,
        desc: `They have not accepted yet. Cancel fee: ${formatUsdc(challenge.cancelPendingStakeFee)} USDC.`,
      }
    default:
      return {
        tone: 'active',
        label: stateLabel(state),
        title: `Challenge with ${other}.`,
        desc: `Stake: ${stake}.`,
      }
  }
}

export function ChallengeCard({ challenge, config, onOpen, onFinalize, onAccept, onReject, onCancel, onNavigateAccount, nowSeconds }: ChallengeCardProps) {
  const state = getChallengeState(challenge, nowSeconds)
  const content = copyFor(challenge, config, nowSeconds)

  return (
    <article className={`challengeCard ${content.tone}`}>
      <div className="challengeCardBody">
        <div className="challengeLabelRow">
          <span className="attentionLabel">{content.label}</span>
          <button className="plainAddress" onClick={() => onNavigateAccount(challenge.other)}>{shortAddress(challenge.other)}</button>
        </div>

        <h3>{content.title}</h3>
        <p>{content.desc}</p>

        {content.metaLeft || content.metaRight ? (
          <div className="challengeMetaLine">
            {content.metaLeft ? <span>{content.metaLeft}</span> : null}
            {content.metaRight ? <span>{content.metaRight}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="challengeActions">
        {state === 'ready-finalize' ? <button className="primaryButton small" onClick={() => onFinalize(challenge)}>Finalize</button> : null}
        {state === 'pending-incoming' ? (
          <>
            <button className="primaryButton small" onClick={() => onAccept(challenge)}>Accept</button>
            <button className="ghostButton small" onClick={() => onReject(challenge)}>Reject</button>
          </>
        ) : null}
        {state === 'pending-outgoing' ? <button className="ghostButton small" onClick={() => onCancel(challenge)}>Cancel</button> : null}
        {state === 'steal-open' ? <button className="dangerButton small" onClick={() => onOpen(challenge)}>Steal Pot</button> : null}
      </div>
    </article>
  )
}
