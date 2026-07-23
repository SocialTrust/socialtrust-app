import type { ChallengeView } from '../types'
import { countdownUntil, formatUsdc, shortAddress, timestampToDate } from '../lib/format'
import { getChallengeState, stateLabel } from '../lib/challenges'
import { Sheet } from './Sheet'

type ChallengeDetailSheetProps = {
  challenge?: ChallengeView
  onClose: () => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onSteal: (challenge: ChallengeView) => void
  onNavigateAccount: (address: string) => void
  nowSeconds: number
}

export function ChallengeDetailSheet({ challenge, onClose, onFinalize, onAccept, onReject, onCancel, onSteal, onNavigateAccount, nowSeconds }: ChallengeDetailSheetProps) {
  const state = challenge ? getChallengeState(challenge, nowSeconds) : 'unknown'
  const pot = challenge ? challenge.stakeAmount * 2n : 0n
  const treasury = challenge ? pot - challenge.stealBounty : 0n
  const refundPerUser = challenge ? challenge.stakeAmount - (challenge.friendshipSuccessFee ?? 0n) : 0n

  return (
    <Sheet open={Boolean(challenge)} title="Challenge details" description={challenge ? stateLabel(state) : undefined} onClose={onClose}>
      {challenge ? (
        <div className="detailStack">
          <div className="detailHero">
            <span>{stateLabel(state)}</span>
            <h3>You + <button className="plainAddress inverted" onClick={() => onNavigateAccount(challenge.other)}>{shortAddress(challenge.other)}</button></h3>
            {challenge.challengeEndsAt !== 0n ? <p>Ends in {countdownUntil(challenge.challengeEndsAt, nowSeconds)}</p> : <p>Waiting for both people to stake.</p>}
          </div>

          <div className="termsBox">
            <div><span>Stake each</span><strong>{formatUsdc(challenge.stakeAmount)} USDC</strong></div>
            <div><span>Steal bounty</span><strong>{formatUsdc(challenge.stealBounty)} USDC</strong></div>
            <div><span>Success fee</span><strong>{formatUsdc(challenge.friendshipSuccessFee)} USDC</strong></div>
            <div><span>Steal opens</span><strong>{timestampToDate(challenge.stealAllowedAt)}</strong></div>
            <div><span>Finalizes</span><strong>{timestampToDate(challenge.challengeEndsAt)}</strong></div>
          </div>

          <section className="timelineCard">
            <h4>Timeline</h4>
            <div className="timelineRow done"><span />You staked</div>
            <div className={`timelineRow ${challenge.otherStaked ? 'done' : ''}`}><span />They staked</div>
            <div className={`timelineRow ${state === 'steal-open' || state === 'ready-finalize' ? 'done' : ''}`}><span />Steal window</div>
            <div className={`timelineRow ${state === 'ready-finalize' ? 'done' : ''}`}><span />Finalize friendship</div>
          </section>

          <section className="explainCard">
            <h4>Outcomes</h4>
            <p><strong>If nobody steals:</strong> each person gets back {formatUsdc(refundPerUser)} USDC, the friendship is recorded, and bonuses may be paid.</p>
            <p><strong>If someone steals:</strong> the thief receives {formatUsdc(challenge.stealBounty)} USDC, {formatUsdc(treasury)} USDC goes to the bonus pool, and the friendship fails.</p>
          </section>

          <div className="stickyActions">
            {state === 'ready-finalize' ? <button className="primaryButton full" onClick={() => onFinalize(challenge)}>Finalize friendship</button> : null}
            {state === 'pending-incoming' ? (
              <>
                <button className="primaryButton full" onClick={() => onAccept(challenge)}>Accept & stake</button>
                <button className="ghostButton full" onClick={() => onReject(challenge)}>Reject</button>
              </>
            ) : null}
            {state === 'pending-outgoing' ? <button className="ghostButton full" onClick={() => onCancel(challenge)}>Cancel pending stake</button> : null}
            {state === 'steal-open' ? <button className="dangerButton full" onClick={() => onSteal(challenge)}>Steal pot</button> : null}
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
