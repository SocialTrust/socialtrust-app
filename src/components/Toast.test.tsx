// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUCCESS_TOAST_DURATION_MS, Toast } from './Toast'
import type { TransactionState } from '../types'

const pendingTx: TransactionState = { pending: true, label: 'Saving profile…' }
const successTx: TransactionState = { pending: false, label: 'Profile updated', success: 'Profile saved on-chain.' }
const errorTx: TransactionState = { pending: false, label: '', error: 'Transaction reverted: insufficient allowance.' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function setup(tx: TransactionState) {
  const onClear = vi.fn()
  const view = render(<Toast tx={tx} onClear={onClear} />)
  return { onClear, rerender: (next: TransactionState) => view.rerender(<Toast tx={next} onClear={onClear} />) }
}

describe('Toast lifecycle', () => {
  it('auto-dismisses a success toast after the success duration', () => {
    const { onClear } = setup(successTx)
    expect(screen.getByText('Profile updated')).toBeTruthy()

    advance(SUCCESS_TOAST_DURATION_MS - 1)
    expect(onClear).not.toHaveBeenCalled()

    advance(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('uses a 4 second success duration', () => {
    expect(SUCCESS_TOAST_DURATION_MS).toBe(4000)
  })

  it('never auto-dismisses a pending toast', () => {
    const { onClear } = setup(pendingTx)
    expect(screen.getByText('Saving profile…')).toBeTruthy()

    advance(60_000)
    expect(onClear).not.toHaveBeenCalled()
  })

  it('never auto-dismisses an error toast', () => {
    const { onClear } = setup(errorTx)
    expect(screen.getByText('Transaction failed')).toBeTruthy()

    advance(60_000)
    expect(onClear).not.toHaveBeenCalled()
  })

  it('dismisses a success toast manually, and the pending timer does not fire afterwards', () => {
    const { onClear } = setup(successTx)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(onClear).toHaveBeenCalledTimes(1)

    advance(SUCCESS_TOAST_DURATION_MS * 2)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('dismisses an error toast manually', () => {
    const { onClear } = setup(errorTx)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('dismisses a pending toast manually', () => {
    const { onClear } = setup(pendingTx)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('does not let an old success timer dismiss a newer toast', () => {
    const { onClear, rerender } = setup(successTx)
    advance(SUCCESS_TOAST_DURATION_MS - 500)

    rerender({ pending: true, label: 'Depositing USDC…' })
    advance(SUCCESS_TOAST_DURATION_MS * 2)

    expect(onClear).not.toHaveBeenCalled()
    expect(screen.getByText('Depositing USDC…')).toBeTruthy()
  })

  it('restarts the timer when one success toast replaces another', () => {
    const { onClear, rerender } = setup(successTx)
    advance(SUCCESS_TOAST_DURATION_MS - 500)

    rerender({ pending: false, label: 'Match found', success: 'You are matched.' })
    advance(SUCCESS_TOAST_DURATION_MS - 500)
    expect(onClear).not.toHaveBeenCalled()

    advance(500)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('starts the success timer when a pending toast resolves to success', () => {
    const { onClear, rerender } = setup(pendingTx)
    advance(30_000)
    expect(onClear).not.toHaveBeenCalled()

    rerender(successTx)
    advance(SUCCESS_TOAST_DURATION_MS - 1)
    expect(onClear).not.toHaveBeenCalled()

    advance(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('starts no timer when a pending toast resolves to an error', () => {
    const { onClear, rerender } = setup(pendingTx)

    rerender(errorTx)
    advance(60_000)

    expect(onClear).not.toHaveBeenCalled()
    expect(screen.getByText('Transaction failed')).toBeTruthy()
  })

  it('does not restart the success timer when the caller passes a new onClear identity', () => {
    const first = vi.fn()
    const view = render(<Toast tx={successTx} onClear={first} />)
    advance(SUCCESS_TOAST_DURATION_MS - 1)

    const second = vi.fn()
    view.rerender(<Toast tx={successTx} onClear={second} />)
    advance(1)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('clears a running success timer when the toast unmounts', () => {
    const { onClear } = setup(successTx)
    advance(SUCCESS_TOAST_DURATION_MS - 500)

    cleanup()
    advance(SUCCESS_TOAST_DURATION_MS)

    expect(onClear).not.toHaveBeenCalled()
  })
})
