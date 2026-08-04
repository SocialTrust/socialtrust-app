/**
 * Strict, non-throwing parsing for every numeric value that reaches a contract
 * call.
 *
 * The previous implementation ran user input through `Number()` and then handed
 * the original string to `BigInt()`. That accepted things it should not have
 * and failed in ways the UI never surfaced: "1e3" and "Infinity" passed the
 * Number check and then threw inside BigInt, "-5" produced a negative amount
 * for an unsigned contract argument, "1.1234567" was silently truncated to six
 * decimals, and empty input became a valid 0.
 *
 * These parsers validate the string with a regular expression before any
 * conversion, never use floating point, and return `undefined` instead of
 * throwing so callers can refuse to submit a transaction.
 */

export const USDC_DECIMALS = 6

/** Digits, optionally followed by a point and one to six digits. */
const USDC_PATTERN = /^\d+(?:\.\d{1,6})?$/
/** Digits only. */
const INTEGER_PATTERN = /^\d+$/

export const USDC_AMOUNT_ERROR =
  'Enter an amount as digits with up to 6 decimal places, for example 10 or 0.5.'

export const INTEGER_AMOUNT_ERROR = 'Enter a whole number using digits only.'

/**
 * Parses a USDC amount into base units (6 decimals).
 *
 * Returns `undefined` for anything that is not a plain unsigned decimal:
 * empty input, signs, exponent notation, `Infinity`, `NaN`, thousands
 * separators, more than one point, or more than six decimal places.
 */
export function parseUsdcStrict(input: string | undefined): bigint | undefined {
  const value = (input ?? '').trim()
  if (!USDC_PATTERN.test(value)) return undefined

  const [whole, fraction = ''] = value.split('.')
  // Right-pad to exactly six digits. The pattern already caps the length, so
  // this never truncates a digit the user typed.
  const scaledFraction = fraction.padEnd(USDC_DECIMALS, '0')

  try {
    return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(scaledFraction)
  } catch {
    return undefined
  }
}

/**
 * Parses an unsigned whole number — durations in seconds, basis points,
 * reputation scores. Returns `undefined` for anything but digits.
 */
export function parseIntegerStrict(input: string | undefined): bigint | undefined {
  const value = (input ?? '').trim()
  if (!INTEGER_PATTERN.test(value)) return undefined

  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

/**
 * Renders base units as a plain decimal string that `parseUsdcStrict` accepts:
 * no thousands separators, no currency symbols.
 *
 * `formatUsdc` is for display and groups thousands ("1,234.50"), so its output
 * must never be fed back into a parser. Use this wherever a computed amount is
 * passed on as a string.
 */
export function formatUsdcPlain(value: bigint): string {
  if (value < 0n) throw new RangeError('USDC amounts cannot be negative.')

  const scale = 10n ** BigInt(USDC_DECIMALS)
  const whole = value / scale
  const fraction = value % scale
  if (fraction === 0n) return whole.toString()

  const digits = fraction.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return `${whole}.${digits}`
}
