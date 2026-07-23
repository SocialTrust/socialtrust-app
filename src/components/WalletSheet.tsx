import { useMemo, useState } from 'react'
import type { UserSnapshot } from '../types'
import { formatUsdc, parseUsdc } from '../lib/format'
import { Sheet } from './Sheet'

type WalletSheetProps = {
  open: boolean
  snapshot?: UserSnapshot
  onClose: () => void
  onApprove: () => void
  onDeposit: (amount: string) => void
  onWithdraw: (amount: string) => void
  onFundBonusPool: (amount: string) => void
}

export function WalletSheet({ open, snapshot, onClose, onApprove, onDeposit, onWithdraw, onFundBonusPool }: WalletSheetProps) {
  const [amount, setAmount] = useState('')

  const amountUnits = useMemo(() => parseUsdc(amount), [amount])
  const needsApproval = amountUnits > 0n && (snapshot?.allowance ?? 0n) < amountUnits
  const depositLabel = needsApproval ? 'Approve + deposit' : 'Deposit'

  return (
    <Sheet open={open} title="Wallet" description="Manage your USDC inside SocialTrust." onClose={onClose}>
      <div className="walletGrid">
        <div className="walletBalance"><span>Wallet USDC</span><strong>{formatUsdc(snapshot?.walletUsdc)}</strong></div>
        <div className="walletBalance"><span>App balance</span><strong>{formatUsdc(snapshot?.appBalance)}</strong></div>
        <div className="walletBalance"><span>Approved</span><strong>{formatUsdc(snapshot?.allowance)}</strong></div>
      </div>

      <div className="formStack">
        <label>
          <span>Amount</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="25.00" />
        </label>
        {needsApproval ? (
          <div className="balanceHint compactHint">
            <span>This amount needs approval first. The app will ask for approval, then deposit.</span>
          </div>
        ) : null}
        <div className="buttonGrid">
          <button className="primaryButton" onClick={() => onDeposit(amount)}>{depositLabel}</button>
          <button className="secondaryButton" onClick={onApprove}>Approve max</button>
          <button className="ghostButton" onClick={() => onWithdraw(amount)}>Withdraw</button>
          <button className="ghostButton" onClick={() => onFundBonusPool(amount)}>Fund bonus pool</button>
        </div>
      </div>
    </Sheet>
  )
}
