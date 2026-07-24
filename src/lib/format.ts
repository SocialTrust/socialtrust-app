import type { Address } from 'viem'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export function shortAddress(address?: string, chars = 4) {
  if (!address) return 'Not connected'
  if (address.length < 12) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatUsdc(value?: bigint, opts?: { compact?: boolean; truncate?: boolean }) {
  let raw = value ?? 0n
  // Truncating to whole cents (rather than rounding) guarantees a balance is
  // never displayed higher than what the account actually holds.
  if (opts?.truncate) raw -= raw % 10_000n
  const amount = Number(raw) / 1_000_000
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: opts?.compact ? 2 : 2,
  }).format(amount)
}

export function parseUsdc(input: string) {
  const cleaned = input.trim().replace(/,/g, '')
  if (!cleaned || Number.isNaN(Number(cleaned))) return 0n
  const [whole, fraction = ''] = cleaned.split('.')
  const safeFraction = `${fraction.slice(0, 6)}000000`.slice(0, 6)
  return BigInt(whole || '0') * 1_000_000n + BigInt(safeFraction || '0')
}

export function secondsToLabel(seconds?: bigint | number, opts?: { raw?: boolean }) {
  const total = Math.max(0, Math.floor(Number(seconds ?? 0)))
  if (opts?.raw) return `${total}s`

  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  return `${secs}s`
}

export function countdownUntil(ts?: bigint, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!ts || ts === 0n) return '—'
  return secondsToLabel(Number(ts) - nowSeconds)
}

export function timestampToDate(ts?: bigint) {
  if (!ts || ts === 0n) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Number(ts) * 1000))
}


export function relativeTime(ts?: bigint, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!ts || ts === 0n) return 'recently'
  const diff = Math.max(0, nowSeconds - Number(ts))
  if (diff < 60) return 'just now'
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function isAddressLike(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

export function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase())
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard?.writeText(value)
  } catch {
    // Ignore clipboard failures. The UI still exposes the full address.
  }
}
