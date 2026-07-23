import { useEffect, useState } from 'react'
import type { ContractConfig, UserSnapshot } from '../types'
import { formatUsdc, secondsToLabel } from '../lib/format'
import { Sheet } from './Sheet'

type StartFriendshipSheetProps = {
  open: boolean
  initialOther?: string
  config?: ContractConfig
  snapshot?: UserSnapshot
  isConnected: boolean
  onClose: () => void
  onConnect: () => void
  onStake: (other: string) => Promise<boolean>
  onDepositAndStake: (other: string, amount: string) => Promise<boolean>
}

export function StartFriendshipSheet({ open, initialOther, config, snapshot, isConnected, onClose, onConnect, onStake, onDepositAndStake }: StartFriendshipSheetProps) {
  const [other, setOther] = useState(initialOther ?? '')
  const [depositAmount, setDepositAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setOther(initialOther ?? '')
  }, [initialOther, open])

  const stake = config?.stakeAmt ?? 0n
  const appBalance = snapshot?.appBalance ?? 0n
  const missingStake = stake > appBalance ? stake - appBalance : 0n
  const hasEnough = Boolean(snapshot && appBalance >= stake)

  const submitStake = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const success = await onStake(other)
      if (success) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const submitDepositAndStake = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const success = await onDepositAndStake(other, depositAmount || formatUsdc(missingStake))
      if (success) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} title="Start friendship" description="Stake USDC with an address. If both of you make it through the timer, you become friends." onClose={onClose}>
      {!isConnected ? (
        <div className="emptyState inset">
          <h3>Connect first</h3>
          <p>You need a wallet to start a friendship challenge.</p>
          <button className="primaryButton" onClick={onConnect}>Connect wallet</button>
        </div>
      ) : (
        <div className="formStack">
          <label>
            <span>Friend address</span>
            <input value={other} onChange={(event) => setOther(event.target.value)} placeholder="0x..." autoFocus />
          </label>

          <div className="termsBox">
            <div><span>Stake required</span><strong>{formatUsdc(stake)} USDC</strong></div>
            <div><span>Challenge length</span><strong>{secondsToLabel(config?.challengeDuration)}</strong></div>
            <div><span>Steal opens after</span><strong>{secondsToLabel(config?.stealGracePeriod)}</strong></div>
            <div><span>Steal bounty</span><strong>{formatUsdc(config?.stealBounty)} USDC</strong></div>
            <div><span>Success fee</span><strong>{formatUsdc(config?.friendshipSuccessFee)} USDC</strong></div>
          </div>

          <div className="balanceHint">
            <span>Your app balance</span>
            <strong>{formatUsdc(snapshot?.appBalance)} USDC</strong>
          </div>

          {hasEnough ? (
            <button className="primaryButton full" disabled={submitting} onClick={submitStake}>{submitting ? 'Confirming…' : 'Stake for friendship'}</button>
          ) : (
            <div className="depositPrompt">
              <p>You need {formatUsdc(missingStake)} more USDC in your app balance. Deposit the missing amount and stake in one transaction flow.</p>
              <label>
                <span>Deposit amount</span>
                <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder={formatUsdc(missingStake)} inputMode="decimal" />
              </label>
              <button className="primaryButton full" disabled={submitting} onClick={submitDepositAndStake}>{submitting ? 'Confirming…' : 'Deposit & stake'}</button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
