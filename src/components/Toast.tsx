import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import type { TransactionState } from '../types'

type ToastProps = {
  tx: TransactionState
  onClear: () => void
}

function titleFor(tx: TransactionState) {
  if (tx.pending) return tx.label || 'Waiting for confirmation'
  if (tx.error) {
    const lower = tx.error.toLowerCase()
    if (lower.includes('reject') || lower.includes('denied') || lower.includes('cancel')) return 'Transaction cancelled'
    if (lower.includes('chain') || lower.includes('network') || lower.includes('switch your wallet')) return 'Wrong network'
    return 'Transaction failed'
  }
  return tx.label || 'Transaction complete'
}

function messageFor(tx: TransactionState) {
  if (tx.pending) return 'Confirm in your wallet, then wait for the chain receipt.'
  if (tx.error) return tx.error
  return tx.success || 'Your balance and activity will refresh automatically.'
}

export function Toast({ tx, onClear }: ToastProps) {
  const visible = tx.pending || tx.error || tx.success
  const tone = tx.error ? 'error' : tx.success ? 'success' : 'pending'

  useEffect(() => {
    if (!visible || tx.pending) return
    const timeout = window.setTimeout(onClear, tx.error ? 8000 : 4200)
    return () => window.clearTimeout(timeout)
  }, [onClear, tx.error, tx.pending, visible])

  if (!visible) return null

  return (
    <div className={`toastStack`} role="status" aria-live={tx.error ? 'assertive' : 'polite'}>
      <div className={`toast ${tone}`}>
        <div className="toastIcon" aria-hidden="true">
          {tone === 'success' ? <CheckCircle2 size={19} /> : tone === 'error' ? <AlertCircle size={19} /> : <Loader2 size={19} className="spin" />}
        </div>
        <div className="toastCopy">
          <strong>{titleFor(tx)}</strong>
          <p>{messageFor(tx)}</p>
        </div>
        {!tx.pending ? <button className="toastClose" onClick={onClear} aria-label="Dismiss notification"><X size={16} /></button> : null}
      </div>
    </div>
  )
}
