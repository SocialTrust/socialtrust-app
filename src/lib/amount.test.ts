import { describe, expect, it } from 'vitest'
import { formatUsdcPlain, parseIntegerStrict, parseUsdcStrict } from './amount'

describe('parseUsdcStrict', () => {
  it('parses whole amounts', () => {
    expect(parseUsdcStrict('0')).toBe(0n)
    expect(parseUsdcStrict('10')).toBe(10_000_000n)
    expect(parseUsdcStrict('1000')).toBe(1_000_000_000n)
  })

  it('parses decimals up to six places', () => {
    expect(parseUsdcStrict('0.5')).toBe(500_000n)
    expect(parseUsdcStrict('0.05')).toBe(50_000n)
    expect(parseUsdcStrict('1.123456')).toBe(1_123_456n)
    expect(parseUsdcStrict('0.000001')).toBe(1n)
    expect(parseUsdcStrict('25.00')).toBe(25_000_000n)
  })

  it('trims surrounding whitespace', () => {
    expect(parseUsdcStrict('  12.5  ')).toBe(12_500_000n)
  })

  it('rejects more than six decimal places rather than truncating', () => {
    // The old parser silently dropped the seventh digit and sent a different
    // amount than the one on screen.
    expect(parseUsdcStrict('1.1234567')).toBeUndefined()
    expect(parseUsdcStrict('0.0000001')).toBeUndefined()
  })

  it('rejects empty input', () => {
    expect(parseUsdcStrict('')).toBeUndefined()
    expect(parseUsdcStrict('   ')).toBeUndefined()
    expect(parseUsdcStrict(undefined)).toBeUndefined()
  })

  it('rejects exponent notation', () => {
    // Number('1e3') is 1000, so the old check passed and BigInt('1e3') threw.
    expect(parseUsdcStrict('1e3')).toBeUndefined()
    expect(parseUsdcStrict('1E3')).toBeUndefined()
    expect(parseUsdcStrict('1e-3')).toBeUndefined()
    expect(parseUsdcStrict('1.5e2')).toBeUndefined()
  })

  it('rejects Infinity and NaN', () => {
    expect(parseUsdcStrict('Infinity')).toBeUndefined()
    expect(parseUsdcStrict('-Infinity')).toBeUndefined()
    expect(parseUsdcStrict('NaN')).toBeUndefined()
  })

  it('rejects signs and negative values', () => {
    expect(parseUsdcStrict('-5')).toBeUndefined()
    expect(parseUsdcStrict('-0.5')).toBeUndefined()
    expect(parseUsdcStrict('+5')).toBeUndefined()
    expect(parseUsdcStrict('- 5')).toBeUndefined()
  })

  it('rejects malformed decimals', () => {
    expect(parseUsdcStrict('.')).toBeUndefined()
    expect(parseUsdcStrict('.5')).toBeUndefined()
    expect(parseUsdcStrict('5.')).toBeUndefined()
    expect(parseUsdcStrict('1.2.3')).toBeUndefined()
    expect(parseUsdcStrict('1..2')).toBeUndefined()
    expect(parseUsdcStrict('1,5')).toBeUndefined()
  })

  it('rejects thousands separators and other stray characters', () => {
    // formatUsdc groups thousands, so its output must never round-trip here.
    expect(parseUsdcStrict('1,234.50')).toBeUndefined()
    expect(parseUsdcStrict('$10')).toBeUndefined()
    expect(parseUsdcStrict('10 USDC')).toBeUndefined()
    expect(parseUsdcStrict('abc')).toBeUndefined()
    expect(parseUsdcStrict('0x10')).toBeUndefined()
    expect(parseUsdcStrict('1_000')).toBeUndefined()
  })

  it('keeps full precision for amounts beyond Number.MAX_SAFE_INTEGER', () => {
    // No floating point anywhere in the path.
    expect(parseUsdcStrict('9007199254740993.123456')).toBe(9_007_199_254_740_993_123_456n)
  })
})

describe('parseIntegerStrict', () => {
  it('parses whole numbers', () => {
    expect(parseIntegerStrict('0')).toBe(0n)
    expect(parseIntegerStrict('86400')).toBe(86_400n)
    expect(parseIntegerStrict(' 1000 ')).toBe(1_000n)
  })

  it('rejects anything that is not digits', () => {
    expect(parseIntegerStrict('')).toBeUndefined()
    expect(parseIntegerStrict('   ')).toBeUndefined()
    expect(parseIntegerStrict(undefined)).toBeUndefined()
    expect(parseIntegerStrict('12.5')).toBeUndefined()
    expect(parseIntegerStrict('-5')).toBeUndefined()
    expect(parseIntegerStrict('+5')).toBeUndefined()
    expect(parseIntegerStrict('1e3')).toBeUndefined()
    expect(parseIntegerStrict('Infinity')).toBeUndefined()
    expect(parseIntegerStrict('NaN')).toBeUndefined()
    expect(parseIntegerStrict('1,000')).toBeUndefined()
    expect(parseIntegerStrict('120s')).toBeUndefined()
    expect(parseIntegerStrict('0x10')).toBeUndefined()
  })

  it('keeps full precision beyond Number.MAX_SAFE_INTEGER', () => {
    // Math.floor(Number(...)) used to lose the low digits here.
    expect(parseIntegerStrict('9007199254740993')).toBe(9_007_199_254_740_993n)
  })
})

describe('formatUsdcPlain', () => {
  it('produces a string the strict parser accepts', () => {
    for (const value of [0n, 1n, 500_000n, 25_000_000n, 1_234_500_000n, 9_007_199_254_740_993_123_456n]) {
      const text = formatUsdcPlain(value)
      expect(parseUsdcStrict(text)).toBe(value)
    }
  })

  it('never groups thousands', () => {
    expect(formatUsdcPlain(1_234_500_000n)).toBe('1234.5')
    expect(formatUsdcPlain(25_000_000n)).toBe('25')
    expect(formatUsdcPlain(1n)).toBe('0.000001')
    expect(formatUsdcPlain(0n)).toBe('0')
  })
})
