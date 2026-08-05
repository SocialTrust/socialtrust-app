import { describe, expect, it } from 'vitest'
import { collectConfigProblems } from './config'

const VALID = {
  contractAddress: '0x00000000000000000000000000000000000000bb',
  usdcAddress: '0x00000000000000000000000000000000000000cc',
  rawChainId: '84532',
}

const ZERO = '0x0000000000000000000000000000000000000000'

function variables(input: Parameters<typeof collectConfigProblems>[0]) {
  return collectConfigProblems(input).map((problem) => problem.variable)
}

describe('collectConfigProblems', () => {
  it('reports nothing for a complete configuration', () => {
    expect(collectConfigProblems(VALID)).toEqual([])
  })

  it('reports a missing contract address', () => {
    expect(variables({ ...VALID, contractAddress: undefined })).toEqual(['VITE_SOCIALTRUST_ADDRESS'])
    expect(variables({ ...VALID, contractAddress: '' })).toEqual(['VITE_SOCIALTRUST_ADDRESS'])
    expect(variables({ ...VALID, contractAddress: '   ' })).toEqual(['VITE_SOCIALTRUST_ADDRESS'])
  })

  it('treats the zero address as missing, not as a usable contract', () => {
    // This is the case that used to silently enable mock mode.
    expect(variables({ ...VALID, contractAddress: ZERO })).toEqual(['VITE_SOCIALTRUST_ADDRESS'])
    expect(variables({ ...VALID, usdcAddress: ZERO })).toEqual(['VITE_USDC_ADDRESS'])
  })

  it('reports a malformed address', () => {
    expect(variables({ ...VALID, contractAddress: '0x123' })).toEqual(['VITE_SOCIALTRUST_ADDRESS'])
    expect(variables({ ...VALID, contractAddress: 'not-an-address' })).toEqual(['VITE_SOCIALTRUST_ADDRESS'])
    expect(variables({ ...VALID, usdcAddress: '0xZZZZ00000000000000000000000000000000cccc' })).toEqual(['VITE_USDC_ADDRESS'])
  })

  it('reports a missing USDC address', () => {
    expect(variables({ ...VALID, usdcAddress: undefined })).toEqual(['VITE_USDC_ADDRESS'])
  })

  it('reports a missing or invalid chain id', () => {
    expect(variables({ ...VALID, rawChainId: undefined })).toEqual(['VITE_CHAIN_ID'])
    expect(variables({ ...VALID, rawChainId: '' })).toEqual(['VITE_CHAIN_ID'])
    expect(variables({ ...VALID, rawChainId: 'mainnet' })).toEqual(['VITE_CHAIN_ID'])
    expect(variables({ ...VALID, rawChainId: '0' })).toEqual(['VITE_CHAIN_ID'])
    expect(variables({ ...VALID, rawChainId: '-1' })).toEqual(['VITE_CHAIN_ID'])
    expect(variables({ ...VALID, rawChainId: '1.5' })).toEqual(['VITE_CHAIN_ID'])
  })

  it('reports every problem at once, so one redeploy can fix them all', () => {
    expect(variables({})).toEqual(['VITE_SOCIALTRUST_ADDRESS', 'VITE_USDC_ADDRESS', 'VITE_CHAIN_ID'])
  })

  it('names the variable to set in each message', () => {
    for (const problem of collectConfigProblems({})) {
      expect(problem.message).toContain(problem.variable)
    }
  })

  it('accepts a checksummed address', () => {
    expect(collectConfigProblems({
      ...VALID,
      contractAddress: '0xa0A4a7D6c8d06EcaA084384363D95D77eadF4497',
    })).toEqual([])
  })
})
