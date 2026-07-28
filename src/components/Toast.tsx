import { useCallback, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import type { TransactionState } from '../types'

export const SUCCESS_TOAST_DURATION_MS = 4000

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

  // onClear is recreated by the caller on every render, so keep it out of the
  // timer effect's dependencies — otherwise a re-render would restart the timer.
  const onClearRef = useRef(onClear)
  useEffect(() => {
    onClearRef.current = onClear
  }, [onClear])

  const timeoutRef = useRef<number | null>(null)
  const cancelTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Only a success toast auto-dismisses. Pending toasts wait for the transaction
  // to resolve, and errors stay until the user reads and dismisses them. The
  // effect keys on the tx identity, so a timer started for one toast is always
  // cleared before a newer toast can be dismissed by it.
  useEffect(() => {
    if (tone !== 'success') return
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      onClearRef.current()
    }, SUCCESS_TOAST_DURATION_MS)
    return cancelTimer
  }, [cancelTimer, tone, tx])

  const dismiss = useCallback(() => {
    cancelTimer()
    onClearRef.current()
  }, [cancelTimer])

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
        <button className="toastClose" onClick={dismiss} aria-label="Dismiss notification"><X size={16} /></button>
      </div>
    </div>
  )
}
