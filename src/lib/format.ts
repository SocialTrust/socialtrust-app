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

/** Shown wherever a value has not loaded yet. Never used for a real zero. */
export const NOT_LOADED = '—'

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

/**
 * Natural-language duration for prose captions ("10 minutes", "1 day",
 * "14 days"). The largest unit leads and a second unit is appended only when
 * it is non-zero, so a sub-day window is never rounded up to "1 days".
 * secondsToLabel stays the compact form used inside dense rows.
 */
export function durationLabel(seconds?: bigint | number) {
  const total = Math.max(0, Math.floor(Number(seconds ?? 0)))

  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (days > 0) return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day')
  if (hours > 0) return mins > 0 ? `${plural(hours, 'hour')} ${plural(mins, 'minute')}` : plural(hours, 'hour')
  if (mins > 0) return secs > 0 ? `${plural(mins, 'minute')} ${plural(secs, 'second')}` : plural(mins, 'minute')
  return plural(secs, 'second')
}

/**
 * Contract configuration that has not been read yet is unknown, not zero.
 * These render the placeholder for `undefined` while still printing a genuine
 * on-chain `0n` as zero.
 */
export function formatUsdcOrDash(value?: bigint, opts?: { compact?: boolean; truncate?: boolean }) {
  return value === undefined ? NOT_LOADED : formatUsdc(value, opts)
}

export function secondsToLabelOrDash(seconds?: bigint | number) {
  return seconds === undefined ? NOT_LOADED : secondsToLabel(seconds)
}

export function durationLabelOrDash(seconds?: bigint | number) {
  return seconds === undefined ? NOT_LOADED : durationLabel(seconds)
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
