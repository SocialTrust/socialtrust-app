import { describe, expect, it } from 'vitest'
import {
  NOT_LOADED,
  durationLabel,
  durationLabelOrDash,
  formatUsdc,
  formatUsdcOrDash,
  secondsToLabelOrDash,
} from './format'

describe('durationLabel', () => {
  it('never rounds a sub-day window up to a day', () => {
    // The bug this replaces rendered a 10-minute match window as "1 days".
    expect(durationLabel(600n)).toBe('10 minutes')
    expect(durationLabel(30n)).toBe('30 seconds')
    expect(durationLabel(3600n)).toBe('1 hour')
  })

  it('uses singular wording for a count of one', () => {
    expect(durationLabel(1n)).toBe('1 second')
    expect(durationLabel(60n)).toBe('1 minute')
    expect(durationLabel(3600n)).toBe('1 hour')
    expect(durationLabel(86_400n)).toBe('1 day')
  })

  it('uses plural wording for every other count', () => {
    expect(durationLabel(2n)).toBe('2 seconds')
    expect(durationLabel(120n)).toBe('2 minutes')
    expect(durationLabel(7_200n)).toBe('2 hours')
    expect(durationLabel(1_209_600n)).toBe('14 days')
  })

  it('adds a second unit only when the remainder is non-zero', () => {
    expect(durationLabel(90_000n)).toBe('1 day 1 hour')
    expect(durationLabel(5_400n)).toBe('1 hour 30 minutes')
    expect(durationLabel(90n)).toBe('1 minute 30 seconds')
    expect(durationLabel(172_800n)).toBe('2 days')
  })

  it('treats zero as a real zero duration', () => {
    expect(durationLabel(0n)).toBe('0 seconds')
  })
})

describe('unloaded-configuration placeholders', () => {
  it('renders the placeholder for undefined rather than a fabricated zero', () => {
    expect(formatUsdcOrDash(undefined)).toBe(NOT_LOADED)
    expect(secondsToLabelOrDash(undefined)).toBe(NOT_LOADED)
    expect(durationLabelOrDash(undefined)).toBe(NOT_LOADED)
  })

  it('still renders a genuine on-chain zero as zero', () => {
    expect(formatUsdcOrDash(0n)).toBe('0.00')
    expect(formatUsdcOrDash(0n)).toBe(formatUsdc(0n))
    expect(secondsToLabelOrDash(0n)).toBe('0s')
    expect(durationLabelOrDash(0n)).toBe('0 seconds')
  })

  it('passes formatting options through', () => {
    expect(formatUsdcOrDash(1_234_567n, { truncate: true })).toBe('1.23')
  })
})
