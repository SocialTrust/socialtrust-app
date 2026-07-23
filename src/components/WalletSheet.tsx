import { useMemo, useState } from 'react'
import type { UserSnapshot } from '../types'
import { formatUsdc, parseUsdc } from '../lib/format'
import { Sheet } from './Sheet'

type WalletSheetProps = {
  open: boolean
  snapshot?: UserSnapshot
  onClose: () => void
  onDeposit: (amount: string) => void
  onWithdraw: (amount: string) => void
}

const QUICK_AMOUNTS = ['5.00', '10.00', '25.00']

export function WalletSheet({ open, snapshot, onClose, onDeposit, onWithdraw }: WalletSheetProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')

  const amountUnits = useMemo(() => parseUsdc(amount), [amount])
  const appBalance = snapshot?.appBalance ?? 0n
  const balance = tab === 'deposit' ? snapshot?.walletUsdc ?? 0n : appBalance
  const validAmount = amountUnits > 0n && amountUnits <= balance
  const needsApproval = tab === 'deposit' && amountUnits > 0n && (snapshot?.allowance ?? 0n) < amountUnits

  const entered = amount.trim()
  const actionLabel =
    tab === 'deposit'
      ? needsApproval
        ? `Approve + deposit $ ${entered}`
        : entered
          ? `Deposit $ ${entered}`
          : 'Deposit'
      : entered
        ? `Withdraw $ ${entered}`
        : 'Withdraw'
  const balanceAfter = tab === 'deposit' ? appBalance + amountUnits : appBalance - amountUnits

  const balancesHeader = (
    <div className="walletHeaderBalances">
      <span>Wallet</span><strong>$ {formatUsdc(snapshot?.walletUsdc)}</strong>
      <span>App</span><strong>$ {formatUsdc(snapshot?.appBalance)}</strong>
    </div>
  )

  return (
    <Sheet open={open} title="Wallet" header={balancesHeader} onClose={onClose}>
      <div className="formStack">
        <div className="segmentedControl">
          <button
            className={`segmentedOption ${tab === 'deposit' ? 'active' : ''}`}
            aria-pressed={tab === 'deposit'}
            onClick={() => setTab('deposit')}
          >
            Deposit
          </button>
          <button
            className={`segmentedOption ${tab === 'withdraw' ? 'active' : ''}`}
            aria-pressed={tab === 'withdraw'}
            onClick={() => setTab('withdraw')}
          >
            Withdraw
          </button>
        </div>

        <div>
          <div className="amountContext">
            <label htmlFor="walletAmount">Amount</label>
            <span className="amountContextBalance">
              Available: <strong>$ {formatUsdc(balance, { compact: true })}</strong>
            </span>
          </div>
          <input
            id="walletAmount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="25.00"
          />
          <div className="quickChips">
            {QUICK_AMOUNTS.map((quick) => (
              <button key={quick} className="quickChip" onClick={() => setAmount(quick)}>
                ${Number(quick).toFixed(0)}
              </button>
            ))}
            <button className="quickChip" onClick={() => setAmount(formatUsdc(balance, { truncate: true }))}>Max</button>
          </div>
        </div>

        <button
          className="primaryButton full"
          disabled={!validAmount}
          onClick={() => (tab === 'deposit' ? onDeposit(amount) : onWithdraw(amount))}
        >
          {actionLabel}
        </button>

        {validAmount ? (
          <div className="walletFooter">
            <span>App balance after: $ {formatUsdc(balanceAfter)}</span>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}
