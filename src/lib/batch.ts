import type { Abi, Address, WalletClient } from 'viem'
import { encodeFunctionData, numberToHex } from 'viem'
import { appConfig } from './config'

export type BatchCall = {
  to: Address
  abi: Abi
  functionName: string
  args: readonly unknown[]
}

export type BatchResult =
  | { supported: true; hashes: `0x${string}`[] }
  | { supported: false }

type CallsStatus = {
  status?: number | string
  receipts?: { transactionHash?: `0x${string}`; status?: string | number }[]
}

// EIP-5792 is spoken over raw RPC rather than a viem/wagmi helper on purpose:
// the method names are stable across library versions, and an unsupported
// wallet simply rejects the request, which is exactly the signal we want in
// order to fall back to sequential writeContract calls.

function isUnsupported(error: unknown): boolean {
  const code = (error as { code?: number } | undefined)?.code
  if (code === 4200 || code === -32601 || code === -32602) return true

  const message = String((error as { message?: string } | undefined)?.message ?? '').toLowerCase()
  return (
    message.includes('unsupported') ||
    message.includes('not supported') ||
    message.includes('does not exist') ||
    message.includes('method not found') ||
    message.includes('unrecognized')
  )
}

function isFinal(status: CallsStatus['status']): boolean {
  // Numeric statuses arrive as 200 (confirmed) or 4xx/5xx (failed).
  if (typeof status === 'number') return status >= 200
  const value = String(status ?? '').toUpperCase()
  return value === 'CONFIRMED' || value === 'FAILED' || value === 'SUCCESS' || value === 'REVERTED'
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Send several contract calls as one wallet confirmation.
 *
 * On a smart account (Coinbase Smart Wallet and friends) this turns
 * "approve, wait, then deposit" into a single Face ID prompt with both calls
 * executed atomically. On an EOA wallet the request is rejected and the caller
 * should fall back to sending the calls one at a time.
 */
export async function sendBatchedCalls(
  walletClient: WalletClient,
  account: Address,
  chainId: number,
  calls: BatchCall[],
): Promise<BatchResult> {
  if (!appConfig.batchCalls) return { supported: false }
  if (calls.length === 0) return { supported: true, hashes: [] }

  const encoded = calls.map((call) => ({
    to: call.to,
    value: '0x0',
    data: encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    }),
  }))

  const capabilities = appConfig.paymasterUrl
    ? { paymasterService: { url: appConfig.paymasterUrl } }
    : undefined

  let id: string
  try {
    const response = await walletClient.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '1.0',
          chainId: numberToHex(chainId),
          from: account,
          calls: encoded,
          ...(capabilities ? { capabilities } : {}),
        },
      ],
    } as never)

    // Newer wallets return { id }, older ones return a bare string.
    id = typeof response === 'string'
      ? response
      : String((response as { id?: string } | undefined)?.id ?? '')

    if (!id) return { supported: false }
  } catch (error) {
    if (isUnsupported(error)) return { supported: false }
    throw error
  }

  // Poll until the bundle is final. Generous budget: a first-time smart account
  // deploys itself as part of this bundle.
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(1000)

    let status: CallsStatus
    try {
      status = (await walletClient.request({
        method: 'wallet_getCallsStatus',
        params: [id],
      } as never)) as CallsStatus
    } catch (error) {
      if (isUnsupported(error)) return { supported: false }
      continue
    }

    if (!isFinal(status?.status)) continue

    const receipts = status.receipts ?? []
    const reverted = receipts.some((receipt) => {
      const value = String(receipt?.status ?? '').toLowerCase()
      return value === 'reverted' || value === '0x0' || value === '0'
    })

    const numeric = typeof status.status === 'number' ? status.status : undefined
    const failed = reverted || (numeric !== undefined && numeric >= 300)
    if (failed) throw new Error('Transaction reverted on-chain.')

    const hashes = receipts
      .map((receipt) => receipt?.transactionHash)
      .filter((hash): hash is `0x${string}` => Boolean(hash))

    return { supported: true, hashes }
  }

  throw new Error('Timed out waiting for the batched transaction to confirm.')
}
