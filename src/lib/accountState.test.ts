import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { isCurrentRequest, ownedSnapshot } from './accountState'

const A = '0x000000000000000000000000000000000000000a' as Address
const B = '0x000000000000000000000000000000000000000b' as Address
const A_UPPER = '0x000000000000000000000000000000000000000A' as Address

describe('isCurrentRequest', () => {
  it('accepts a result for the connected account and the newest request', () => {
    expect(isCurrentRequest({ user: A, requestId: 3 }, A, 3)).toBe(true)
  })

  it('accepts a partial result, which carries no request id', () => {
    expect(isCurrentRequest({ user: A }, A, 7)).toBe(true)
  })

  it('compares accounts without regard to checksum casing', () => {
    expect(isCurrentRequest({ user: A_UPPER }, A, 1)).toBe(true)
  })

  it('rejects a result for a different account', () => {
    expect(isCurrentRequest({ user: A, requestId: 3 }, B, 3)).toBe(false)
    expect(isCurrentRequest({ user: A }, B, 3)).toBe(false)
  })

  it('rejects every result once the wallet disconnects', () => {
    expect(isCurrentRequest({ user: A, requestId: 3 }, undefined, 3)).toBe(false)
    expect(isCurrentRequest({ user: A }, undefined, 3)).toBe(false)
  })

  it('rejects a superseded request even for the right account', () => {
    // A→B→A leaves an older in-flight load for A that must not win.
    expect(isCurrentRequest({ user: A, requestId: 2 }, A, 5)).toBe(false)
  })
})

describe('ownedSnapshot', () => {
  const snapshot = { friends: [A] }

  it('returns the snapshot to its own account', () => {
    expect(ownedSnapshot(snapshot, A, A)).toBe(snapshot)
    expect(ownedSnapshot(snapshot, A_UPPER, A)).toBe(snapshot)
  })

  it('withholds a snapshot belonging to another account', () => {
    // The rule behind the Graph fallback: better an empty list for the right
    // wallet than the previous wallet's friends, challenges or activity.
    expect(ownedSnapshot(snapshot, B, A)).toBeUndefined()
  })

  it('withholds a snapshot with no recorded owner', () => {
    expect(ownedSnapshot(snapshot, undefined, A)).toBeUndefined()
  })

  it('returns undefined when there is no snapshot', () => {
    expect(ownedSnapshot(undefined, A, A)).toBeUndefined()
  })
})
