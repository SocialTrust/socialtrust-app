import { useEffect, useMemo, useState } from 'react'
import type { UserSnapshot } from '../types'
import { formatUsdc } from '../lib/format'
import { formatUsdcPlain, parseUsdcStrict } from '../lib/amount'
import { appConfig } from '../lib/config'
import { Sheet } from './Sheet'

type WalletSheetProps = {
  open: boolean
  snapshot?: UserSnapshot
  /** Which tab the sheet opens on, so Account can deep-link Deposit/Withdraw. */
  initialTab?: 'deposit' | 'withdraw'
  onClose: () => void
  onDeposit: (amount: string) => Promise<boolean | void> | void
  onWithdraw: (amount: string) => Promise<boolean | void> | void
}

const QUICK_AMOUNTS = ['5.00', '10.00', '25.00']

export function WalletSheet({ open, snapshot, initialTab = 'deposit', onClose, onDeposit, onWithdraw }: WalletSheetProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>(initialTab)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setAmount('')
    }
  }, [open, initialTab])

  // undefined means the text is not a valid amount, which is different from
  // zero: the action stays disabled rather than submitting a silent 0.
  const amountUnits = useMemo(() => parseUsdcStrict(amount), [amount])
  const appBalance = snapshot?.appBalance ?? 0n
  const balance = tab === 'deposit' ? snapshot?.walletUsdc ?? 0n : appBalance
  const validAmount = amountUnits !== undefined && amountUnits > 0n && amountUnits <= balance
  const needsApproval = tab === 'deposit' && amountUnits !== undefined && amountUnits > 0n && (snapshot?.allowance ?? 0n) < amountUnits

  const entered = amount.trim()
  const actionLabel = submitting
    ? 'Confirming…'
    : tab === 'deposit'
      ? entered
        ? needsApproval ? `Approve + deposit ${entered} USDC` : `Deposit ${entered} USDC`
        : 'Deposit'
      : entered ? `Withdraw ${entered} USDC` : 'Withdraw'

  const submit = async () => {
    if (submitting || !validAmount) return
    setSubmitting(true)
    try {
      const success = tab === 'deposit' ? await onDeposit(amount) : await onWithdraw(amount)
      if (success) {
        setAmount('')
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const footer = (
    <>
      <button className="primaryButton full" type="button" disabled={!validAmount || submitting} onClick={submit}>
        {actionLabel}
      </button>
      {needsApproval ? (
        <p className="footerCaption">Your USDC allowance is below this amount, so your wallet asks for an approval first, then the deposit.</p>
      ) : (
        <p className="footerCaption">App balance is held by SocialTrust for stakes and match fees. Wallet USDC stays in your wallet.</p>
      )}
    </>
  )

  return (
    <Sheet open={open} title="Funds" description={`USDC on ${appConfig.chainName}`} onClose={onClose} busy={submitting} footer={footer}>
      <div className="formStack">
        <div className="balanceSplit">
          <div>
            <span>App balance</span>
            <strong>{formatUsdc(snapshot?.appBalance)} USDC</strong>
          </div>
          <div>
            <span>Wallet USDC</span>
            <strong>{formatUsdc(snapshot?.walletUsdc)} USDC</strong>
          </div>
        </div>

        <div className="segmentedControl">
          <button
            className={`segmentedOption ${tab === 'deposit' ? 'active' : ''}`}
            type="button"
            aria-pressed={tab === 'deposit'}
            onClick={() => setTab('deposit')}
          >
            Deposit
          </button>
          <button
            className={`segmentedOption ${tab === 'withdraw' ? 'active' : ''}`}
            type="button"
            aria-pressed={tab === 'withdraw'}
            onClick={() => setTab('withdraw')}
          >
            Withdraw
          </button>
        </div>

        <label className="fieldLabel" htmlFor="walletAmount">
          <span className="fieldLabelRow">
            Amount
            <span className="fieldLabelHint">Available {formatUsdc(balance)} USDC</span>
          </span>
          <input
            id="walletAmount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="25.00"
          />
        </label>

        <div className="quickChips">
          {QUICK_AMOUNTS.map((quick) => (
            <button key={quick} className="quickChip" type="button" onClick={() => setAmount(quick)}>
              {formatUsdc(parseUsdcStrict(quick), { compact: true })} USDC
            </button>
          ))}
          <button className="quickChip" type="button" onClick={() => setAmount(formatUsdcPlain(balance))}>Max</button>
        </div>
      </div>
    </Sheet>
  )
}
