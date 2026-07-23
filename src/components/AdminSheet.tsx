import { useEffect, useState } from 'react'
import type { ContractConfig } from '../types'
import { formatUsdc } from '../lib/format'
import { Sheet } from './Sheet'

type AdminSheetProps = {
  open: boolean
  config?: ContractConfig
  onClose: () => void
  onSetChallengeConfig: (values: { stakeAmt: string; cancelFee: string; rejectFee: string; durationSeconds: string; graceSeconds: string; stealBounty: string; friendshipSuccessFee: string }) => void
  onSetBonusConfig: (values: { payoutBps: string; maxTreasurySpendBps: string; maxBonusPerSuccess: string }) => void
  onSetScore: (user: string, score: string) => void
}

export function AdminSheet({ open, config, onClose, onSetChallengeConfig, onSetBonusConfig, onSetScore }: AdminSheetProps) {
  const [challenge, setChallenge] = useState({
    stakeAmt: config ? formatUsdc(config.stakeAmt) : '',
    cancelFee: config ? formatUsdc(config.cancelPendingStakeFee) : '',
    rejectFee: config ? formatUsdc(config.rejectPendingStakeFee) : '',
    durationSeconds: config ? String(config.challengeDuration) : '',
    graceSeconds: config ? String(config.stealGracePeriod) : '',
    stealBounty: config ? formatUsdc(config.stealBounty) : '',
    friendshipSuccessFee: config ? formatUsdc(config.friendshipSuccessFee) : '',
  })
  const [bonus, setBonus] = useState({
    payoutBps: config ? String(config.payoutBps) : '1000',
    maxTreasurySpendBps: config ? String(config.maxTreasurySpendBps) : '500',
    maxBonusPerSuccess: config ? formatUsdc(config.maxBonusPerSuccess) : '10',
  })
  const [scoreUser, setScoreUser] = useState('')
  const [score, setScore] = useState('')

  useEffect(() => {
    if (!open || !config) return
    setChallenge({
      stakeAmt: formatUsdc(config.stakeAmt),
      cancelFee: formatUsdc(config.cancelPendingStakeFee),
      rejectFee: formatUsdc(config.rejectPendingStakeFee),
      durationSeconds: String(config.challengeDuration),
      graceSeconds: String(config.stealGracePeriod),
      stealBounty: formatUsdc(config.stealBounty),
      friendshipSuccessFee: formatUsdc(config.friendshipSuccessFee),
    })
    setBonus({
      payoutBps: String(config.payoutBps),
      maxTreasurySpendBps: String(config.maxTreasurySpendBps),
      maxBonusPerSuccess: formatUsdc(config.maxBonusPerSuccess),
    })
  }, [open, config])


  return (
    <Sheet open={open} title="Admin" description="Owner-only contract settings." onClose={onClose}>
      <div className="formStack">
        <section className="adminSection">
          <h3>Challenge settings</h3>
          <p className="adminHelp">Enter challenge duration and steal grace as raw seconds. Grace must be less than duration.</p>
          <div className="twoColForm">
            <label><span>Stake USDC</span><input value={challenge.stakeAmt} onChange={(e) => setChallenge({ ...challenge, stakeAmt: e.target.value })} /></label>
            <label><span>Cancel fee</span><input value={challenge.cancelFee} onChange={(e) => setChallenge({ ...challenge, cancelFee: e.target.value })} /></label>
            <label><span>Reject fee</span><input value={challenge.rejectFee} onChange={(e) => setChallenge({ ...challenge, rejectFee: e.target.value })} /></label>
            <label><span>Challenge duration seconds</span><input inputMode="numeric" value={challenge.durationSeconds} onChange={(e) => setChallenge({ ...challenge, durationSeconds: e.target.value })} placeholder="120" /></label>
            <label><span>Steal grace seconds</span><input inputMode="numeric" value={challenge.graceSeconds} onChange={(e) => setChallenge({ ...challenge, graceSeconds: e.target.value })} placeholder="30" /></label>
            <label><span>Steal bounty</span><input value={challenge.stealBounty} onChange={(e) => setChallenge({ ...challenge, stealBounty: e.target.value })} /></label>
            <label><span>Success fee</span><input value={challenge.friendshipSuccessFee} onChange={(e) => setChallenge({ ...challenge, friendshipSuccessFee: e.target.value })} /></label>
          </div>
          <button className="primaryButton full" onClick={() => onSetChallengeConfig(challenge)}>Save challenge settings</button>
        </section>

        <section className="adminSection">
          <h3>Bonus settings</h3>
          <div className="twoColForm">
            <label><span>Payout bps</span><input value={bonus.payoutBps} onChange={(e) => setBonus({ ...bonus, payoutBps: e.target.value })} /></label>
            <label><span>Max treasury bps</span><input value={bonus.maxTreasurySpendBps} onChange={(e) => setBonus({ ...bonus, maxTreasurySpendBps: e.target.value })} /></label>
            <label><span>Max bonus USDC</span><input value={bonus.maxBonusPerSuccess} onChange={(e) => setBonus({ ...bonus, maxBonusPerSuccess: e.target.value })} /></label>
          </div>
          <button className="primaryButton full" onClick={() => onSetBonusConfig(bonus)}>Save bonus settings</button>
        </section>

        <section className="adminSection">
          <h3>Reputation score</h3>
          <label><span>User address</span><input value={scoreUser} onChange={(e) => setScoreUser(e.target.value)} placeholder="0x..." /></label>
          <label><span>Score</span><input value={score} onChange={(e) => setScore(e.target.value)} /></label>
          <button className="secondaryButton full" onClick={() => onSetScore(scoreUser, score)}>Set score</button>
        </section>
      </div>
    </Sheet>
  )
}
