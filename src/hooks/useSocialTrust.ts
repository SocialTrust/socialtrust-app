import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'
import { createPublicClient, http, maxUint256 } from 'viem'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import { socialTrustAbi, erc20Abi } from '../contracts/socialTrustAbi'
import { socialTrustProfilesAbi } from '../contracts/socialTrustProfilesAbi'
import type { AccountProfile, ActivityItem, ChallengeView, ContractConfig, MatchQueueState, MatchState, SocialProfile, TransactionState, UserSnapshot } from '../types'
import { appConfig, configuredChain } from '../lib/config'
import { isAddressLike, parseUsdc, sameAddress, ZERO_ADDRESS } from '../lib/format'
import { mockConfig, mockProfile, mockRecentActivity, mockSnapshot, mockUser } from '../lib/mock'

const publicClient = createPublicClient({
  chain: configuredChain,
  transport: appConfig.rpcUrl ? http(appConfig.rpcUrl) : http(),
})

async function waitForSuccessfulReceipt(hash: `0x${string}`) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.')
  return receipt
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

type ActionName =
  | 'deposit'
  | 'withdraw'
  | 'fundBonusPool'
  | 'approveUsdc'
  | 'stakeForFriendship'
  | 'depositAndStakeForFriendship'
  | 'cancelPendingStake'
  | 'rejectPendingStake'
  | 'steal'
  | 'finalizeFriendship'
  | 'matchMe'
  | 'depositAndMatchMe'
  | 'cancelMatchMe'
  | 'cleanupMyExpiredMatch'
  | 'setChallengeConfig'
  | 'setBonusConfig'
  | 'setScore'
  | 'setProfile'

function txErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const viemError = error as Error & { shortMessage?: string; details?: string }
    const message = viemError.shortMessage || viemError.details || error.message
    const lower = message.toLowerCase()

    if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
      return 'You rejected the request in your wallet.'
    }
    if (lower.includes('current chain') || lower.includes('does not match') || lower.includes('wrong network') || lower.includes('switch chain')) {
      return `Switch your wallet to ${appConfig.chainName} before continuing.`
    }
    if (lower.includes('alreadyinmatchqueue')) return 'You are already waiting in the matchmaking queue.'
    if (lower.includes('alreadymatched')) return 'You already have an active match.'
    if (lower.includes('notinmatchqueue')) return 'You are no longer in the matchmaking queue.'
    if (lower.includes('matchstillactive')) return 'This match is still active and cannot be cleaned up yet.'
    if (lower.includes('matchnotfound')) return 'This match no longer exists.'
    if (lower.includes('insufficientbalance') || lower.includes('insufficient balance')) {
      return 'Your app balance is too low for this action. Deposit USDC first, or use an action that deposits and stakes in one step.'
    }
    if (lower.includes('insufficient funds')) {
      return `Your wallet says there is not enough ETH for gas. Make sure the connected account has ETH on ${appConfig.chainName}, not just another Base/Ethereum network.`
    }
    if (lower.includes('over rate limit') || lower.includes('rate limit')) {
      return 'The RPC provider is rate limiting requests. Try again in a moment or use a private RPC endpoint.'
    }
    if (lower.includes('execution reverted') || lower.includes('transaction reverted')) {
      return 'The contract rejected this action. Check your app balance, wallet USDC, allowance, timing, or admin permissions.'
    }

    return message
  }
  return 'Transaction failed.'
}

function getUsdcAmountForAction(action: ActionName, args: readonly unknown[]) {
  if (action === 'deposit' || action === 'fundBonusPool' || action === 'depositAndMatchMe') return args[0] as bigint | undefined
  if (action === 'depositAndStakeForFriendship') return args[1] as bigint | undefined
  return undefined
}

function successMessage(action: ActionName, args: readonly unknown[]) {
  const amount = getUsdcAmountForAction(action, args)
  const amountText = typeof amount === 'bigint' ? `${Number(amount) / 1_000_000} USDC` : undefined

  if (action === 'deposit') return amountText ? `${amountText} added to your app balance.` : 'USDC added to your app balance.'
  if (action === 'withdraw') return 'USDC sent back to your wallet.'
  if (action === 'fundBonusPool') return amountText ? `${amountText} added to the rewards pool.` : 'Rewards pool funded.'
  if (action === 'approveUsdc') return 'SocialTrust can now use your USDC when you choose to deposit or stake.'
  if (action === 'stakeForFriendship') return 'Stake locked.'
  if (action === 'depositAndStakeForFriendship') return 'USDC deposited and stake locked.'
  if (action === 'cancelPendingStake') return 'Invite cancelled and available refund returned.'
  if (action === 'rejectPendingStake') return 'Invite rejected.'
  if (action === 'steal') return 'Pot stolen and bounty credited.'
  if (action === 'finalizeFriendship') return 'Friendship finalized and stake returned.'
  if (action === 'matchMe') return 'Matchmaking request submitted.'
  if (action === 'depositAndMatchMe') return 'USDC deposited and matchmaking joined.'
  if (action === 'cancelMatchMe') return 'Matchmaking request cancelled and the available refund returned.'
  if (action === 'cleanupMyExpiredMatch') return 'Expired match cleared.'
  if (action === 'setChallengeConfig') return 'Challenge settings updated.'
  if (action === 'setBonusConfig') return 'Bonus settings updated.'
  if (action === 'setScore') return 'Reputation score updated.'
  if (action === 'setProfile') return 'Profile details saved.'

  return 'Transaction confirmed.'
}


function walletConnectionError() {
  if (!appConfig.walletConnectProjectId) {
    return 'Set VITE_WALLETCONNECT_PROJECT_ID to enable the standard wallet connection modal.'
  }
  return 'Wallet modal is not ready yet. Try again in a moment.'
}

// Profile field normalization + validation. setProfile overwrites the whole
// profile on chain, so these run on both the full multi-field save and every
// per-field helper to keep a single source of truth for what gets stored.
export type ProfileField = 'displayName' | 'xUsername' | 'telegramUsername' | 'discordUsername' | 'imgUrl'

const PROFILE_FIELD_LABEL: Record<ProfileField, string> = {
  displayName: 'Display name',
  xUsername: 'X username',
  telegramUsername: 'Telegram username',
  discordUsername: 'Discord username',
  imgUrl: 'Image URL',
}

// Turn a pasted handle or profile URL into a bare username: drop a leading "@",
// strip a "t.me/", "x.com/", or "twitter.com/" prefix (with optional scheme /
// "www."), keep only the first path segment, trim, and lowercase.
function normalizeHandleInput(raw: string): string {
  let value = (raw ?? '').trim()
  value = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  value = value.replace(/^(?:t\.me|telegram\.me|x\.com|twitter\.com)\//i, '')
  value = value.replace(/^@+/, '')
  value = value.split(/[/?#]/)[0]
  return value.trim().toLowerCase()
}

function normalizeDisplayNameInput(raw: string): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeImgUrlInput(raw: string): string {
  return (raw ?? '').trim()
}

function normalizeProfileField(field: ProfileField, raw: string): string {
  if (field === 'displayName') return normalizeDisplayNameInput(raw)
  if (field === 'imgUrl') return normalizeImgUrlInput(raw)
  return normalizeHandleInput(raw)
}

// Validate an already-normalized value. Returns an error string or null. Empty
// handles/URLs are allowed here (the full save may legitimately clear a field);
// per-field helpers reject empties before calling this.
function validateProfileField(field: ProfileField, value: string): string | null {
  if (field === 'displayName') {
    if (!value) return 'Display name is required.'
    if (value.length > 64) return 'Display name must be 64 characters or less.'
    if (!/^[A-Za-z0-9_. -]+$/.test(value)) return 'Display name can only use letters, numbers, spaces, underscores, dashes, and periods.'
    if (!/[A-Za-z0-9]/.test(value)) return 'Display name needs at least one letter or number.'
    return null
  }
  if (field === 'xUsername') {
    if (value && !/^[a-z0-9_]{5,15}$/.test(value)) return 'X username must be 5–15 lowercase letters, numbers, or underscores.'
    return null
  }
  if (field === 'telegramUsername') {
    if (value && !/^[a-z0-9_]{5,32}$/.test(value)) return 'Telegram username must be 5–32 lowercase letters, numbers, or underscores.'
    return null
  }
  if (field === 'discordUsername') {
    if (value && !/^[a-z0-9_.]{2,32}$/.test(value)) return 'Discord username must be 2–32 lowercase letters, numbers, underscores, or periods.'
    return null
  }
  // imgUrl
  if (value && (!value.startsWith('https://') || /\s/.test(value) || value.length > 1024)) return 'Image URL must be a valid https:// URL without spaces.'
  return null
}

function profileToArgs(profile: SocialProfile): [string, string, string, string, string] {
  return [profile.displayName, profile.xUsername, profile.telegramUsername, profile.discordUsername, profile.imgUrl]
}

type GraphChallenge = {
  id: string
  pairKey: `0x${string}`
  account0: Address
  account1: Address
  stakeAmount: string
  cancelPendingStakeFee: string
  rejectPendingStakeFee: string
  challengeDuration: string
  stealGracePeriod: string
  stealBounty: string
  friendshipSuccessFee: string
  staked0: boolean
  staked1: boolean
  challengeStartedAt: string
  stealAllowedAt: string
  challengeEndsAt: string
  status: string
}

type GraphChallengeParticipant = {
  id: string
  pairKey: `0x${string}`
  account: Address
  other: Address
  status: string
  updatedAt: string
  challenge: GraphChallenge
}

type GraphFriendship = {
  id: string
  pairKey: `0x${string}`
  user: Address
  friend: Address
  finalizedAt: string
  transactionHash: `0x${string}`
}

type GraphActivity = {
  id: string
  user: Address
  pairKey?: `0x${string}` | null
  other?: Address | null
  matchId?: string | null
  activityType: string
  amount?: string | null
  bonusAmount?: string | null
  matchFeeRefund?: string | null
  timestamp: string
  blockNumber: string
  transactionHash: `0x${string}`
}

type GraphMatchQueueEntry = {
  user: Address
  feeAmount: string
  cancelFeeAmount: string
  queuedAt: string
  status: string
  refundAmount?: string | null
  matchId?: string | null
}

type GraphMatch = {
  id: string
  matchId: string
  user0: Address
  user1: Address
  feeAmount0: string
  feeAmount1: string
  matchedAt: string
  deadline: string
  status: string
  resolvedAt?: string | null
  feeRefund0?: string | null
  feeRefund1?: string | null
  amountToTreasury?: string | null
}

type GraphUserMatchState = {
  currentQueueEntry?: GraphMatchQueueEntry | null
  activeMatch?: GraphMatch | null
}

type GraphAccountData = {
  challengeParticipants: GraphChallengeParticipant[]
  friendships: GraphFriendship[]
  activities: GraphActivity[]
  users: GraphUserMatchState[]
}

const ACCOUNT_DATA_QUERY = `
  query AccountData($user: Bytes!) {
    users(where: { id: $user }, first: 1) {
      currentQueueEntry {
        user
        feeAmount
        cancelFeeAmount
        queuedAt
        status
        refundAmount
        matchId
      }
      activeMatch {
        id
        matchId
        user0
        user1
        feeAmount0
        feeAmount1
        matchedAt
        deadline
        status
        resolvedAt
        feeRefund0
        feeRefund1
        amountToTreasury
      }
    }
    challengeParticipants(
      where: { account: $user }
      first: 100
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      pairKey
      account
      other
      status
      updatedAt
      challenge {
        id
        pairKey
        account0
        account1
        stakeAmount
        cancelPendingStakeFee
        rejectPendingStakeFee
        challengeDuration
        stealGracePeriod
        stealBounty
        friendshipSuccessFee
        staked0
        staked1
        challengeStartedAt
        stealAllowedAt
        challengeEndsAt
        status
      }
    }
    friendships(
      where: { user: $user }
      first: 100
      orderBy: finalizedAt
      orderDirection: desc
    ) {
      id
      pairKey
      user
      friend
      finalizedAt
      transactionHash
    }
    activities(
      where: { user: $user }
      first: 20
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      user
      pairKey
      other
      activityType
      amount
      bonusAmount
      matchFeeRefund
      matchId
      timestamp
      blockNumber
      transactionHash
    }
  }
`

async function readGraphAccountData(user: Address): Promise<GraphAccountData> {
  if (!appConfig.graphEnabled || !appConfig.graphUrl) {
    return { challengeParticipants: [], friendships: [], activities: [], users: [] }
  }

  const response = await fetch(appConfig.graphUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: ACCOUNT_DATA_QUERY,
      variables: { user: user.toLowerCase() },
    }),
  })

  if (!response.ok) {
    throw new Error(`The Graph query failed with HTTP ${response.status}.`)
  }

  const payload = await response.json() as {
    data?: Partial<GraphAccountData>
    errors?: { message?: string }[]
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message || 'GraphQL error').join('; '))
  }

  return {
    challengeParticipants: payload.data?.challengeParticipants ?? [],
    friendships: payload.data?.friendships ?? [],
    activities: payload.data?.activities ?? [],
    users: payload.data?.users ?? [],
  }
}

function graphActivityToItem(entry: GraphActivity): ActivityItem {
  const amount = entry.amount == null ? undefined : BigInt(entry.amount)
  const bonusAmount = entry.bonusAmount == null ? 0n : BigInt(entry.bonusAmount)
  const matchFeeRefund = entry.matchFeeRefund == null ? 0n : BigInt(entry.matchFeeRefund)
  const other = entry.other && !sameAddress(entry.other, ZERO_ADDRESS) ? entry.other : undefined
  const base = {
    id: entry.id,
    other,
    amount,
    pairKey: entry.pairKey ?? undefined,
    blockNumber: BigInt(entry.blockNumber || '0'),
    timestamp: BigInt(entry.timestamp || '0'),
    txHash: entry.transactionHash,
    matchFeeRefund: matchFeeRefund > 0n ? matchFeeRefund : undefined,
  }

  switch (entry.activityType) {
    case 'DEPOSIT': return { ...base, kind: 'deposit', title: 'Deposit', detail: 'Added to app balance' }
    case 'WITHDRAW': return { ...base, kind: 'withdraw', title: 'Withdrawal', detail: 'Sent to wallet' }
    case 'STAKE_PLACED': return { ...base, kind: 'stake', title: 'Invite sent', detail: 'Stake placed' }
    case 'CHALLENGE_STARTED': return { ...base, kind: 'challenge_started', title: 'Challenge started', detail: 'Both stakes locked' }
    case 'PENDING_STAKE_CANCELLED': return { ...base, kind: 'cancelled', title: 'Invite cancelled', detail: 'Stake returned' }
    case 'INVITE_REJECTED': return { ...base, kind: 'rejected', title: 'Invite rejected', detail: 'You declined', amount: undefined }
    case 'INVITE_DECLINED': return { ...base, kind: 'rejected', title: 'Invite declined', detail: 'Stake returned' }
    case 'POT_STOLEN': return { ...base, kind: 'stolen', title: 'You stole the pot', detail: 'Bounty paid' }
    case 'POT_STOLEN_FROM_YOU': return { ...base, kind: 'stolen', title: 'Pot was stolen', detail: 'Stake forfeited' }
    case 'FRIENDSHIP_FINALIZED': return {
      ...base,
      kind: 'finalized',
      title: 'Friendship finalized',
      detail: bonusAmount > 0n || matchFeeRefund > 0n ? 'Stake returned + rewards' : 'Stake returned and friendship recorded',
    }
    case 'MATCH_QUEUED': return { ...base, kind: 'match', title: 'Matchmaking started', detail: 'Waiting for a compatible account' }
    case 'MATCH_QUEUE_CANCELLED': return { ...base, kind: 'match', title: 'Matchmaking cancelled', detail: 'Available match fee refunded' }
    case 'MATCHED': return { ...base, kind: 'match', title: 'Match found', detail: 'Start a friendship before the deadline' }
    case 'MATCH_EXPIRED': return { ...base, kind: 'match', title: 'Match expired', detail: 'Match fee moved to the rewards pool' }
    default: return { ...base, kind: 'transaction', title: 'Contract activity', detail: entry.activityType }
  }
}

export function useSocialTrust() {
  const { address: wagmiAddress, isConnected: wagmiIsConnected, chainId } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  // Pinned to the app chain: without chainId, wagmi yields no client at all
  // while the wallet sits on an unsupported network, which made every write
  // fail with a bogus "connect first" before the switch prompt could run.
  const { data: walletClient } = useWalletClient({ chainId: appConfig.chainId })
  const { openConnectModal } = useConnectModal()

  const [snapshot, setSnapshot] = useState<UserSnapshot | undefined>(appConfig.isMockMode ? mockSnapshot : undefined)
  const snapshotRef = useRef<UserSnapshot | undefined>(appConfig.isMockMode ? mockSnapshot : undefined)
  const snapshotLoadSeqRef = useRef(0)
  const [config, setConfig] = useState<ContractConfig | undefined>(appConfig.isMockMode ? mockConfig : undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [tx, setTx] = useState<TransactionState>({ pending: false, label: '' })

  const connectedWallet = wagmiAddress as Address | undefined
  const account = connectedWallet ?? (appConfig.isMockMode ? mockUser : undefined)
  const accountRef = useRef<Address | undefined>(account)
  const graphPollSeqRef = useRef(0)
  const isConnected = wagmiIsConnected || appConfig.isMockMode
  const isOwner = Boolean(account && config?.owner && sameAddress(account, config.owner))
  const wrongNetwork = Boolean(!appConfig.isMockMode && isConnected && typeof chainId === 'number' && chainId !== appConfig.chainId)

  useEffect(() => {
    accountRef.current = account
  }, [account])

  useEffect(() => {
    return () => {
      graphPollSeqRef.current += 1
    }
  }, [])

  const readContract = useCallback(async <T,>(functionName: string, args: readonly unknown[] = [], blockNumber?: bigint) => {
    return publicClient.readContract({
      address: appConfig.contractAddress,
      abi: socialTrustAbi,
      functionName: functionName as never,
      args: args as never,
      ...(blockNumber !== undefined ? { blockNumber } : {}),
    }) as Promise<T>
  }, [])

  const readErc20 = useCallback(async <T,>(functionName: string, args: readonly unknown[] = [], blockNumber?: bigint) => {
    return publicClient.readContract({
      address: appConfig.usdcAddress,
      abi: erc20Abi,
      functionName: functionName as never,
      args: args as never,
      ...(blockNumber !== undefined ? { blockNumber } : {}),
    }) as Promise<T>
  }, [])


  const toBigIntValue = useCallback((value: unknown): bigint => {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') return BigInt(value)
    if (typeof value === 'boolean') return value ? 1n : 0n
    return 0n
  }, [])

  const normalizePairChallenge = useCallback((pairKey: `0x${string}`, value: unknown, user: Address): ChallengeView | undefined => {
    const challenge = value as Record<string, unknown> & Record<number, unknown>
    const account0 = (challenge.account0 ?? challenge[0]) as Address | undefined
    const account1 = (challenge.account1 ?? challenge[1]) as Address | undefined

    if (!account0 || !account1 || sameAddress(account0, ZERO_ADDRESS)) return undefined

    const userIs0 = sameAddress(user, account0)
    const userIs1 = sameAddress(user, account1)
    const other = userIs0 ? account1 : userIs1 ? account0 : ZERO_ADDRESS
    const staked0 = Boolean(challenge.staked0 ?? challenge[9] ?? false)
    const staked1 = Boolean(challenge.staked1 ?? challenge[10] ?? false)
    const userStaked = userIs0 ? staked0 : userIs1 ? staked1 : false
    const otherStaked = userIs0 ? staked1 : userIs1 ? staked0 : false
    const stakeAmount = toBigIntValue(challenge.stakeAmount ?? challenge[2])
    const cancelPendingStakeFee = toBigIntValue(challenge.cancelPendingStakeFee ?? challenge[3] ?? config?.cancelPendingStakeFee)
    const rejectPendingStakeFee = toBigIntValue(challenge.rejectPendingStakeFee ?? challenge[4] ?? config?.rejectPendingStakeFee)
    const challengeDuration = toBigIntValue(challenge.challengeDuration ?? challenge[5] ?? config?.challengeDuration)
    const stealGracePeriod = toBigIntValue(challenge.stealGracePeriod ?? challenge[6] ?? config?.stealGracePeriod)
    const stealBounty = toBigIntValue(challenge.stealBounty ?? challenge[7] ?? config?.stealBounty)
    const friendshipSuccessFee = toBigIntValue(challenge.friendshipSuccessFee ?? challenge[8] ?? config?.friendshipSuccessFee)
    const challengeStartedAt = toBigIntValue(challenge.challengeStartedAt ?? challenge[11])
    const stealAllowedAt = challengeStartedAt === 0n ? 0n : challengeStartedAt + stealGracePeriod
    const challengeEndsAt = challengeStartedAt === 0n ? 0n : challengeStartedAt + challengeDuration
    const now = BigInt(Math.floor(Date.now() / 1000))

    return {
      pairKey,
      account0,
      account1,
      other,
      stakeAmount,
      cancelPendingStakeFee,
      rejectPendingStakeFee,
      challengeDuration,
      stealGracePeriod,
      stealBounty,
      friendshipSuccessFee,
      userStaked,
      otherStaked,
      active: challengeStartedAt !== 0n && now < challengeEndsAt,
      challengeStartedAt,
      stealAllowedAt,
      challengeEndsAt,
    }
  }, [config?.cancelPendingStakeFee, config?.challengeDuration, config?.friendshipSuccessFee, config?.rejectPendingStakeFee, config?.stealBounty, config?.stealGracePeriod, toBigIntValue])

  const normalizeChallengeView = useCallback((value: unknown, user: Address): ChallengeView | undefined => {
    const challenge = value as Record<string, unknown> & Record<number, unknown>
    const pairKey = (challenge.pairKey ?? challenge[0]) as ChallengeView['pairKey'] | undefined
    const account0 = (challenge.account0 ?? challenge[1]) as Address | undefined
    const account1 = (challenge.account1 ?? challenge[2]) as Address | undefined

    if (!pairKey || !account0 || !account1 || sameAddress(account0, ZERO_ADDRESS)) return undefined

    const otherFromView = (challenge.other ?? challenge[3]) as Address | undefined
    const userIs0 = sameAddress(user, account0)
    const userIs1 = sameAddress(user, account1)
    const other = otherFromView && !sameAddress(otherFromView, ZERO_ADDRESS)
      ? otherFromView
      : userIs0 ? account1 : userIs1 ? account0 : ZERO_ADDRESS

    return {
      pairKey,
      account0,
      account1,
      other,
      stakeAmount: toBigIntValue(challenge.stakeAmount ?? challenge[4]),
      cancelPendingStakeFee: toBigIntValue(challenge.cancelPendingStakeFee ?? challenge[5] ?? config?.cancelPendingStakeFee),
      rejectPendingStakeFee: toBigIntValue(challenge.rejectPendingStakeFee ?? challenge[6] ?? config?.rejectPendingStakeFee),
      challengeDuration: toBigIntValue(challenge.challengeDuration ?? challenge[7] ?? config?.challengeDuration),
      stealGracePeriod: toBigIntValue(challenge.stealGracePeriod ?? challenge[8] ?? config?.stealGracePeriod),
      stealBounty: toBigIntValue(challenge.stealBounty ?? challenge[9] ?? config?.stealBounty),
      friendshipSuccessFee: toBigIntValue(challenge.friendshipSuccessFee ?? challenge[10] ?? config?.friendshipSuccessFee),
      userStaked: Boolean(challenge.userStaked ?? challenge[11] ?? false),
      otherStaked: Boolean(challenge.otherStaked ?? challenge[12] ?? false),
      active: Boolean(challenge.active ?? challenge[13] ?? false),
      challengeStartedAt: toBigIntValue(challenge.challengeStartedAt ?? challenge[14]),
      stealAllowedAt: toBigIntValue(challenge.stealAllowedAt ?? challenge[15]),
      challengeEndsAt: toBigIntValue(challenge.challengeEndsAt ?? challenge[16]),
    }
  }, [config?.cancelPendingStakeFee, config?.challengeDuration, config?.friendshipSuccessFee, config?.rejectPendingStakeFee, config?.stealBounty, config?.stealGracePeriod, toBigIntValue])

  const normalizeGraphChallenge = useCallback((participant: GraphChallengeParticipant, user: Address): ChallengeView | undefined => {
    const challenge = participant.challenge
    if (!challenge || !challenge.account0 || !challenge.account1) return undefined
    if (participant.status !== 'PENDING' && participant.status !== 'ACTIVE') return undefined

    const userIs0 = sameAddress(user, challenge.account0)
    const userIs1 = sameAddress(user, challenge.account1)
    if (!userIs0 && !userIs1) return undefined

    const challengeStartedAt = BigInt(challenge.challengeStartedAt || '0')
    const challengeEndsAt = BigInt(challenge.challengeEndsAt || '0')
    const now = BigInt(Math.floor(Date.now() / 1000))

    return {
      pairKey: challenge.pairKey,
      account0: challenge.account0,
      account1: challenge.account1,
      other: participant.other,
      stakeAmount: BigInt(challenge.stakeAmount || '0'),
      cancelPendingStakeFee: BigInt(challenge.cancelPendingStakeFee || '0'),
      rejectPendingStakeFee: BigInt(challenge.rejectPendingStakeFee || '0'),
      challengeDuration: BigInt(challenge.challengeDuration || '0'),
      stealGracePeriod: BigInt(challenge.stealGracePeriod || '0'),
      stealBounty: BigInt(challenge.stealBounty || '0'),
      friendshipSuccessFee: BigInt(challenge.friendshipSuccessFee || '0'),
      userStaked: userIs0 ? challenge.staked0 : challenge.staked1,
      otherStaked: userIs0 ? challenge.staked1 : challenge.staked0,
      active: participant.status === 'ACTIVE' && challengeStartedAt !== 0n && now < challengeEndsAt,
      challengeStartedAt,
      stealAllowedAt: BigInt(challenge.stealAllowedAt || '0'),
      challengeEndsAt,
    }
  }, [])

  const normalizeGraphAccountData = useCallback((data: GraphAccountData, user: Address) => {
    const challenges = data.challengeParticipants
      .map((participant) => normalizeGraphChallenge(participant, user))
      .filter((challenge): challenge is ChallengeView => Boolean(challenge))

    const seenFriends = new Set<string>()
    const friends = data.friendships.reduce<Address[]>((result, friendship) => {
      const key = friendship.friend.toLowerCase()
      if (!seenFriends.has(key)) {
        seenFriends.add(key)
        result.push(friendship.friend)
      }
      return result
    }, [])

    const recentActivity = data.activities.map(graphActivityToItem)
    const graphUser = data.users[0]
    const queue = graphUser?.currentQueueEntry
    const match = graphUser?.activeMatch

    const currentQueueEntry: MatchQueueState | undefined = queue && queue.status === 'QUEUED' ? {
      user: queue.user,
      feeAmount: BigInt(queue.feeAmount || '0'),
      cancelFeeAmount: BigInt(queue.cancelFeeAmount || '0'),
      queuedAt: BigInt(queue.queuedAt || '0'),
      status: queue.status,
      refundAmount: queue.refundAmount == null ? undefined : BigInt(queue.refundAmount),
      matchId: queue.matchId == null ? undefined : BigInt(queue.matchId),
    } : undefined

    const activeMatch: MatchState | undefined = match && match.status === 'ACTIVE' ? {
      id: match.id,
      matchId: BigInt(match.matchId || '0'),
      user0: match.user0,
      user1: match.user1,
      feeAmount0: BigInt(match.feeAmount0 || '0'),
      feeAmount1: BigInt(match.feeAmount1 || '0'),
      matchedAt: BigInt(match.matchedAt || '0'),
      deadline: BigInt(match.deadline || '0'),
      status: match.status,
      resolvedAt: match.resolvedAt == null ? undefined : BigInt(match.resolvedAt),
      feeRefund0: match.feeRefund0 == null ? undefined : BigInt(match.feeRefund0),
      feeRefund1: match.feeRefund1 == null ? undefined : BigInt(match.feeRefund1),
      amountToTreasury: match.amountToTreasury == null ? undefined : BigInt(match.amountToTreasury),
    } : undefined

    return { challenges, friends, recentActivity, currentQueueEntry, activeMatch }
  }, [normalizeGraphChallenge])

  const readGraphState = useCallback(async (user: Address) => {
    const data = await readGraphAccountData(user)
    return normalizeGraphAccountData(data, user)
  }, [normalizeGraphAccountData])

  const readChallengeViewForOther = useCallback(async (user: Address, other: Address): Promise<ChallengeView | undefined> => {
    const key = await readContract<ChallengeView['pairKey']>('pairKey', [user, other])
    const view = await readContract<unknown>('getChallengeView', [key, user])
    return normalizeChallengeView(view, user)
  }, [normalizeChallengeView, readContract])


  const emptySocialProfile = useMemo<SocialProfile>(() => ({
    displayName: '',
    xUsername: '',
    telegramUsername: '',
    discordUsername: '',
    imgUrl: '',
    exists: false,
  }), [])

  const normalizeSocialProfile = useCallback((value: unknown): SocialProfile => {
    const profile = value as Partial<SocialProfile> & Record<number, unknown>
    return {
      displayName: String(profile.displayName ?? profile[0] ?? ''),
      xUsername: String(profile.xUsername ?? profile[1] ?? ''),
      telegramUsername: String(profile.telegramUsername ?? profile[2] ?? ''),
      discordUsername: String(profile.discordUsername ?? profile[3] ?? ''),
      imgUrl: String(profile.imgUrl ?? profile[4] ?? ''),
      exists: Boolean(profile.exists ?? profile[5] ?? false),
    }
  }, [])

  const readSocialProfile = useCallback(async (user: Address): Promise<SocialProfile> => {
    if (appConfig.isMockMode) {
      return user.toLowerCase() === mockUser.toLowerCase()
        ? { displayName: 'Jamie', xUsername: 'jamie_judd', telegramUsername: 'jamiejudd', discordUsername: '', imgUrl: '', exists: true }
        : { ...emptySocialProfile }
    }
    if (!appConfig.hasProfiles) return emptySocialProfile

    try {
      const result = await publicClient.readContract({
        address: appConfig.profilesAddress,
        abi: socialTrustProfilesAbi,
        functionName: 'getProfile',
        args: [user],
      })
      return normalizeSocialProfile(result)
    } catch {
      return emptySocialProfile
    }
  }, [emptySocialProfile, normalizeSocialProfile])

  const readSocialProfiles = useCallback(async (users: Address[]): Promise<Record<string, SocialProfile>> => {
    const unique = Array.from(new Set(users.map((user) => user.toLowerCase())))
      .slice(0, 100)
      .map((user) => users.find((candidate) => candidate.toLowerCase() === user)!)

    if (unique.length === 0) return {}
    if (appConfig.isMockMode || !appConfig.hasProfiles) {
      const entries = await Promise.all(unique.map(async (user) => [user.toLowerCase(), await readSocialProfile(user)] as const))
      return Object.fromEntries(entries)
    }

    try {
      const result = await publicClient.readContract({
        address: appConfig.profilesAddress,
        abi: socialTrustProfilesAbi,
        functionName: 'getProfiles',
        args: [unique],
      })
      const profiles = result as unknown[]
      return Object.fromEntries(unique.map((user, index) => [user.toLowerCase(), normalizeSocialProfile(profiles[index])]))
    } catch {
      const entries = await Promise.all(unique.map(async (user) => [user.toLowerCase(), await readSocialProfile(user)] as const))
      return Object.fromEntries(entries)
    }
  }, [emptySocialProfile, normalizeSocialProfile, readSocialProfile])

  const ensureWalletChain = useCallback(async () => {
    if (appConfig.isMockMode) return
    if (!isConnected) throw new Error('Connect your wallet first.')
    if (!walletClient) throw new Error('Connect your wallet first.')

    const walletChainId = await walletClient.getChainId().catch(() => chainId)
    if (walletChainId === appConfig.chainId) return

    try {
      await switchChainAsync({ chainId: appConfig.chainId })

      // Mobile wallets round-trip through an app switch before they report the
      // new chain, so a single check after a short delay reports the old chain
      // and makes a successful switch look like a failure. Poll instead.
      let switched = false
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await sleep(500)
        const switchedChainId = await walletClient.getChainId().catch(() => undefined)
        if (switchedChainId === appConfig.chainId) {
          switched = true
          break
        }
      }

      if (!switched) throw new Error('Wallet did not switch networks.')
    } catch {
      throw new Error(`Open your wallet and switch to ${appConfig.chainName}, then try again.`)
    }
  }, [chainId, isConnected, switchChainAsync, walletClient])


  const loadConfig = useCallback(async () => {
    if (appConfig.isMockMode) {
      setConfig(mockConfig)
      return mockConfig
    }
    if (appConfig.contractAddress.toLowerCase() === ZERO_ADDRESS) return undefined

    const [
      stakeAmt,
      cancelPendingStakeFee,
      rejectPendingStakeFee,
      challengeDuration,
      stealGracePeriod,
      stealBounty,
      friendshipSuccessFee,
      payoutBps,
      maxTreasurySpendBps,
      maxBonusPerSuccess,
      matchFee,
      matchTimeLimit,
      maxMatchScan,
      matchQueueCancelFee,
      bonusPool,
      totalBonusPaid,
      owner,
    ] = await Promise.all([
      readContract<bigint>('stakeAmt'),
      readContract<bigint>('cancelPendingStakeFee'),
      readContract<bigint>('rejectPendingStakeFee'),
      readContract<bigint>('challengeDuration'),
      readContract<bigint>('stealGracePeriod'),
      readContract<bigint>('stealBounty'),
      readContract<bigint>('friendshipSuccessFee'),
      readContract<bigint>('payoutBps'),
      readContract<bigint>('maxTreasurySpendBps'),
      readContract<bigint>('maxBonusPerSuccess'),
      readContract<bigint>('matchFee'),
      readContract<bigint>('matchTimeLimit'),
      readContract<bigint>('maxMatchScan'),
      readContract<bigint>('matchQueueCancelFee'),
      readContract<bigint>('bonusPool'),
      readContract<bigint>('totalBonusPaid'),
      readContract<Address>('owner'),
    ])

    const nextConfig = {
      stakeAmt,
      cancelPendingStakeFee,
      rejectPendingStakeFee,
      challengeDuration,
      stealGracePeriod,
      stealBounty,
      friendshipSuccessFee,
      payoutBps,
      maxTreasurySpendBps,
      maxBonusPerSuccess,
      matchFee,
      matchTimeLimit,
      maxMatchScan,
      matchQueueCancelFee,
      bonusPool,
      totalBonusPaid,
      owner,
    }
    setConfig(nextConfig)
    return nextConfig
  }, [readContract])

  // Queue and match state are read authoritatively from the chain rather than
  // from The Graph. The subgraph lags block confirmation by seconds, which left
  // the matchmaking hero stuck on "Available" after a confirmed matchMe until an
  // indexer caught up. RPC reflects the receipt immediately, so the hero flips
  // the moment the transaction resolves. The subgraph is still used for the
  // partner profile, activity feed, friends, and challenges.
  const readMatchQueueEntryOnChain = useCallback(async (user: Address, blockNumber?: bigint): Promise<MatchQueueState | undefined> => {
    const inQueue = await readContract<boolean>('isInMatchQueue', [user], blockNumber)
    if (!inQueue) return undefined
    const entry = await readContract<Record<string, unknown> & Record<number, unknown>>('matchQueueEntries', [user], blockNumber)
    const queuedUser = (entry.user ?? entry[0]) as Address | undefined
    if (!queuedUser || sameAddress(queuedUser, ZERO_ADDRESS)) return undefined
    return {
      user: queuedUser,
      feeAmount: toBigIntValue(entry.feeAmount ?? entry[1]),
      cancelFeeAmount: toBigIntValue(entry.cancelFeeAmount ?? entry[2]),
      queuedAt: toBigIntValue(entry.queuedAt ?? entry[3]),
      status: 'QUEUED',
    }
  }, [readContract, toBigIntValue])

  const readActiveMatchOnChain = useCallback(async (user: Address, blockNumber?: bigint): Promise<MatchState | undefined> => {
    const matchId = await readContract<bigint>('activeMatchIdOf', [user], blockNumber)
    if (!matchId || matchId === 0n) return undefined
    const match = await readContract<Record<string, unknown> & Record<number, unknown>>('matches', [matchId], blockNumber)
    const user0 = (match.user0 ?? match[0]) as Address | undefined
    const user1 = (match.user1 ?? match[1]) as Address | undefined
    if (!user0 || !user1 || sameAddress(user0, ZERO_ADDRESS)) return undefined
    // A resolved match (finalized or cleaned up) is no longer active. Expired but
    // not-yet-cleaned matches still return here; the hero renders them as
    // Available via its own deadline check, matching the prior subgraph behavior.
    if (Boolean(match.resolved ?? match[6] ?? false)) return undefined
    return {
      id: String(matchId),
      matchId,
      user0,
      user1,
      feeAmount0: toBigIntValue(match.feeAmount0 ?? match[2]),
      feeAmount1: toBigIntValue(match.feeAmount1 ?? match[3]),
      matchedAt: toBigIntValue(match.matchedAt ?? match[4]),
      deadline: toBigIntValue(match.deadline ?? match[5]),
      status: 'ACTIVE',
    }
  }, [readContract, toBigIntValue])

  const readMatchStateOnChain = useCallback(async (user: Address, blockNumber?: bigint) => {
    const [currentQueueEntry, activeMatch] = await Promise.all([
      readMatchQueueEntryOnChain(user, blockNumber),
      readActiveMatchOnChain(user, blockNumber),
    ])
    return { currentQueueEntry, activeMatch }
  }, [readActiveMatchOnChain, readMatchQueueEntryOnChain])

  const refreshMatchStateOnly = useCallback(async (user: Address, blockNumber?: bigint) => {
    const { currentQueueEntry, activeMatch } = await readMatchStateOnChain(user, blockNumber)
    if (!accountRef.current || !sameAddress(accountRef.current, user)) return

    const partner = activeMatch
      ? (sameAddress(activeMatch.user0, user) ? activeMatch.user1 : activeMatch.user0)
      : undefined
    const matchPartnerProfile = partner ? await readSocialProfile(partner).catch(() => undefined) : undefined
    if (!accountRef.current || !sameAddress(accountRef.current, user)) return

    const current = snapshotRef.current
    if (!current) return
    const updated = {
      ...current,
      currentQueueEntry,
      activeMatch,
      matchPartnerProfile: partner ? matchPartnerProfile : undefined,
    }
    snapshotRef.current = updated
    setSnapshot(updated)
  }, [readMatchStateOnChain, readSocialProfile])

  // matchBlockNumber pins the on-chain queue/match reads to a known block —
  // normally the confirmed receipt block of the write that triggered this
  // refresh. Without it these reads use "latest", and because the subgraph can
  // run ahead of a given RPC node's latest height, a post-write refresh could
  // read pre-transaction match state and clobber the freshly confirmed value,
  // flipping the hero back to its old state until a manual refresh.
  const refreshGraphStateOnly = useCallback(async (user: Address, matchBlockNumber?: bigint) => {
    try {
      const [graphState, matchState] = await Promise.all([
        readGraphState(user),
        readMatchStateOnChain(user, matchBlockNumber),
      ])
      if (!accountRef.current || !sameAddress(accountRef.current, user)) return undefined

      const matchPartner = matchState.activeMatch
        ? (sameAddress(matchState.activeMatch.user0, user) ? matchState.activeMatch.user1 : matchState.activeMatch.user0)
        : undefined
      const [friendProfiles, friendRepPairs, matchPartnerProfile] = await Promise.all([
        readSocialProfiles(graphState.friends),
        Promise.all(graphState.friends.map(async (friend) => [friend.toLowerCase(), await readContract<bigint>('repScore', [friend])] as const)),
        matchPartner ? readSocialProfile(matchPartner) : Promise.resolve(undefined),
      ])
      const friendRepScores = Object.fromEntries(friendRepPairs)

      setSnapshot((current) => {
        if (!current) return current
        const updated = {
          ...current,
          friendCount: BigInt(graphState.friends.length),
          friends: graphState.friends,
          challenges: graphState.challenges,
          recentActivity: graphState.recentActivity,
          currentQueueEntry: matchState.currentQueueEntry,
          activeMatch: matchState.activeMatch,
          matchPartnerProfile: matchPartner ? matchPartnerProfile : undefined,
          friendProfiles,
          friendRepScores,
        }
        snapshotRef.current = updated
        return updated
      })

      return graphState
    } catch (error) {
      console.warn('The Graph state refresh failed.', error)
      return undefined
    }
  }, [readContract, readGraphState, readMatchStateOnChain, readSocialProfile, readSocialProfiles])

  const pollGraphForTransaction = useCallback(async (user: Address, hash: `0x${string}`, matchBlockNumber?: bigint) => {
    const pollId = graphPollSeqRef.current + 1
    graphPollSeqRef.current = pollId

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (graphPollSeqRef.current !== pollId) return
      if (attempt > 0) await sleep(1250)
      if (graphPollSeqRef.current !== pollId) return

      try {
        const graphState = await readGraphState(user)
        const indexed = graphState.recentActivity.some((activity) =>
          Boolean(activity.txHash && activity.txHash.toLowerCase() === hash.toLowerCase())
        )

        if (indexed) {
          await refreshGraphStateOnly(user, matchBlockNumber)
          return
        }
      } catch (error) {
        console.warn('The Graph transaction poll failed.', error)
      }
    }

    if (graphPollSeqRef.current === pollId) {
      await refreshGraphStateOnly(user, matchBlockNumber)
    }
  }, [readGraphState, refreshGraphStateOnly])

  const loadSnapshot = useCallback(async (user: Address, _options: { refreshActivity?: boolean } = {}) => {
    if (appConfig.isMockMode) {
      snapshotRef.current = mockSnapshot
      setSnapshot(mockSnapshot)
      return mockSnapshot
    }

    const requestId = snapshotLoadSeqRef.current + 1
    snapshotLoadSeqRef.current = requestId
    const previousSnapshot = snapshotRef.current

    const graphStatePromise = readGraphState(user).catch((error) => {
      console.warn('The Graph account state query failed; preserving the last indexed lists.', error)
      return {
        challenges: previousSnapshot?.challenges ?? [],
        friends: previousSnapshot?.friends ?? [],
        recentActivity: previousSnapshot?.recentActivity ?? [],
        currentQueueEntry: previousSnapshot?.currentQueueEntry,
        activeMatch: previousSnapshot?.activeMatch,
      }
    })

    const [
      appBalance,
      pendingBonus,
      bonusPaidTo,
      repScore,
      owner,
      walletUsdc,
      allowance,
      matchState,
      graphState,
    ] = await Promise.all([
      readContract<bigint>('balances', [user]),
      readContract<bigint>('pendingBonus', [user]),
      readContract<bigint>('bonusPaidTo', [user]),
      readContract<bigint>('repScore', [user]),
      readContract<Address>('owner'),
      appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS ? Promise.resolve(0n) : readErc20<bigint>('balanceOf', [user]),
      appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS ? Promise.resolve(0n) : readErc20<bigint>('allowance', [user, appConfig.contractAddress]),
      readMatchStateOnChain(user).catch((error) => {
        console.warn('On-chain match state read failed; preserving the last known match state.', error)
        return { currentQueueEntry: previousSnapshot?.currentQueueEntry, activeMatch: previousSnapshot?.activeMatch }
      }),
      graphStatePromise,
    ])

    const nextSnapshot: UserSnapshot = {
      walletUsdc,
      appBalance,
      pendingBonus,
      bonusPaidTo,
      repScore,
      allowance,
      friendCount: BigInt(graphState.friends.length),
      friends: graphState.friends,
      challenges: graphState.challenges,
      recentActivity: graphState.recentActivity,
      currentQueueEntry: matchState.currentQueueEntry,
      activeMatch: matchState.activeMatch,
      owner,
      socialProfile: previousSnapshot?.socialProfile,
      friendProfiles: previousSnapshot?.friendProfiles,
      friendRepScores: previousSnapshot?.friendRepScores,
    }

    snapshotRef.current = nextSnapshot
    setSnapshot(nextSnapshot)

    const matchPartner = matchState.activeMatch
      ? (sameAddress(matchState.activeMatch.user0, user) ? matchState.activeMatch.user1 : matchState.activeMatch.user0)
      : undefined

    void Promise.all([
      readSocialProfile(user),
      readSocialProfiles(graphState.friends),
      Promise.all(graphState.friends.map(async (friend) => [friend.toLowerCase(), await readContract<bigint>('repScore', [friend])] as const)),
      matchPartner ? readSocialProfile(matchPartner) : Promise.resolve(undefined),
    ]).then(([socialProfile, friendProfiles, friendRepPairs, matchPartnerProfile]) => {
      if (snapshotLoadSeqRef.current !== requestId) return
      const friendRepScores = Object.fromEntries(friendRepPairs)
      setSnapshot((current) => {
        const base = current ?? nextSnapshot
        const updated = { ...base, socialProfile, friendProfiles, friendRepScores, matchPartnerProfile }
        snapshotRef.current = updated
        return updated
      })
    }).catch((error) => {
      console.warn('Secondary SocialTrust data refresh failed.', error)
    })

    return nextSnapshot
  }, [readContract, readErc20, readGraphState, readMatchStateOnChain, readSocialProfile, readSocialProfiles])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      await loadConfig()
      if (account) await loadSnapshot(account)
    } catch (error) {
      setTx({ pending: false, label: '', error: error instanceof Error ? error.message : 'Could not read contract data.' })
    } finally {
      setIsLoading(false)
    }
  }, [account, loadConfig, loadSnapshot])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Do not auto-request a network switch on route changes.
  // Mobile WalletConnect wallets can briefly report an unknown/wrong chain while pages remount,
  // which made normal navigation look like a failed transaction. Writes still call
  // ensureWalletChain() and request the switch only when the user starts an action.

  const switchToAppNetwork = useCallback(async () => {
    if (appConfig.isMockMode) return
    try {
      await switchChainAsync({ chainId: appConfig.chainId })
    } catch {
      setTx({ pending: false, label: '', error: `Switch your wallet to ${appConfig.chainName} before continuing.` })
    }
  }, [switchChainAsync])

  const disconnect = useCallback(() => {
    snapshotLoadSeqRef.current += 1
    wagmiDisconnect()
    setSnapshot(appConfig.isMockMode ? mockSnapshot : undefined)
    snapshotRef.current = appConfig.isMockMode ? mockSnapshot : undefined
    setTx({ pending: false, label: '', success: 'Wallet disconnected.' })
  }, [wagmiDisconnect])

  const connect = useCallback(() => {
    if (appConfig.isMockMode) {
      setTx({ pending: false, label: '', success: 'Mock wallet connected.' })
      return
    }

    if (!openConnectModal) {
      setTx({ pending: false, label: '', error: walletConnectionError() })
      return
    }

    openConnectModal()
  }, [openConnectModal])


  const readAccountProfile = useCallback(async (profileAddress: Address): Promise<AccountProfile> => {
    if (appConfig.isMockMode) return mockProfile(profileAddress)

    const graphStatePromise = readGraphState(profileAddress).catch((error) => {
      console.warn('The Graph public account query failed.', error)
      return { challenges: [] as ChallengeView[], friends: [] as Address[], recentActivity: [] as ActivityItem[] }
    })

    const [repScore, pendingBonus, bonusPaidTo, owner, graphState] = await Promise.all([
      readContract<bigint>('repScore', [profileAddress]),
      readContract<bigint>('pendingBonus', [profileAddress]),
      readContract<bigint>('bonusPaidTo', [profileAddress]),
      readContract<Address>('owner'),
      graphStatePromise,
    ])

    const friends = graphState.friends
    const challenges = graphState.challenges

    const [socialProfile, friendProfiles, friendRepPairs] = await Promise.all([
      readSocialProfile(profileAddress),
      readSocialProfiles(friends),
      Promise.all(friends.map(async (friend) => [friend.toLowerCase(), await readContract<bigint>('repScore', [friend])] as const)),
    ])

    const friendRepScores = Object.fromEntries(friendRepPairs)

    let isFriendWithViewer: boolean | undefined
    let relationshipChallenge: ChallengeView | undefined
    let appBalance: bigint | undefined
    let walletUsdc: bigint | undefined
    let allowance: bigint | undefined

    if (account) {
      if (!sameAddress(account, profileAddress)) {
        isFriendWithViewer = await readContract<boolean>('areFriends', [account, profileAddress])
        relationshipChallenge = challenges.find((challenge) => sameAddress(challenge.other, account))
      } else {
        appBalance = snapshot?.appBalance ?? await readContract<bigint>('balances', [profileAddress])
        walletUsdc = snapshot?.walletUsdc ?? (appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS ? 0n : await readErc20<bigint>('balanceOf', [profileAddress]))
        allowance = snapshot?.allowance ?? (appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS ? 0n : await readErc20<bigint>('allowance', [profileAddress, appConfig.contractAddress]))
      }
    }

    return {
      address: profileAddress,
      friendCount: BigInt(friends.length),
      challengeCount: BigInt(challenges.length),
      repScore,
      pendingBonus,
      bonusPaidTo,
      friends,
      challenges,
      appBalance,
      walletUsdc,
      allowance,
      owner,
      isFriendWithViewer,
      relationshipChallenge,
      socialProfile,
      friendProfiles,
      friendRepScores,
    }
  }, [account, readContract, readErc20, readGraphState, readSocialProfile, readSocialProfiles, snapshot])

  const ensureUsdcAllowance = useCallback(async (amount: bigint) => {
    if (!walletClient || !account) throw new Error('Connect your wallet first.')
    if (appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS) throw new Error('Set VITE_USDC_ADDRESS before sending USDC transactions.')
    if (amount <= 0n) throw new Error('Enter an amount greater than zero.')

    const [currentAllowance, walletUsdc] = await Promise.all([
      readErc20<bigint>('allowance', [account, appConfig.contractAddress]),
      readErc20<bigint>('balanceOf', [account]),
    ])

    if (walletUsdc < amount) throw new Error('Your wallet USDC balance is too low for that amount.')
    if (currentAllowance >= amount) return

    setTx({ pending: true, label: 'Approve USDC' })
    const hash = await walletClient.writeContract({
      account,
      address: appConfig.usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      chain: configuredChain,
      args: [appConfig.contractAddress, amount],
    })
    await waitForSuccessfulReceipt(hash)
  }, [account, readErc20, walletClient])

  const upsertChallengeInSnapshot = useCallback((challenge: ChallengeView): UserSnapshot | undefined => {
    const base = snapshotRef.current
    if (!base) return undefined

    const pairKey = challenge.pairKey.toLowerCase()
    let replaced = false
    const challenges = base.challenges.map((existing) => {
      if (existing.pairKey.toLowerCase() === pairKey || sameAddress(existing.other, challenge.other)) {
        replaced = true
        return challenge
      }
      return existing
    })

    if (!replaced) challenges.unshift(challenge)

    const updated = { ...base, challenges }
    snapshotRef.current = updated
    setSnapshot(updated)
    return updated
  }, [])

  const removeChallengeFromSnapshot = useCallback((other: Address) => {
    const base = snapshotRef.current
    if (!base) return
    const challenges = base.challenges.filter((challenge) => !sameAddress(challenge.other, other))
    const updated = { ...base, challenges }
    snapshotRef.current = updated
    setSnapshot(updated)
  }, [])

  const refreshCoreStateOnly = useCallback(async (user: Address, blockNumber?: bigint) => {
    const [appBalance, pendingBonus, bonusPaidTo, repScore, owner, walletUsdc, allowance, socialProfile] = await Promise.all([
      readContract<bigint>('balances', [user], blockNumber),
      readContract<bigint>('pendingBonus', [user], blockNumber),
      readContract<bigint>('bonusPaidTo', [user], blockNumber),
      readContract<bigint>('repScore', [user], blockNumber),
      readContract<Address>('owner', [], blockNumber),
      appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS ? Promise.resolve(0n) : readErc20<bigint>('balanceOf', [user], blockNumber),
      appConfig.usdcAddress.toLowerCase() === ZERO_ADDRESS ? Promise.resolve(0n) : readErc20<bigint>('allowance', [user, appConfig.contractAddress], blockNumber),
      readSocialProfile(user),
    ])

    // Keep the ref authoritative immediately. In v44 this happened inside the
    // React state updater, which can run later; a targeted challenge refresh
    // could then read the stale ref and write the old balance back over the
    // freshly fetched balance.
    const current = snapshotRef.current
    if (!current) return

    const updated = { ...current, appBalance, pendingBonus, bonusPaidTo, repScore, owner, walletUsdc, allowance, socialProfile }
    snapshotRef.current = updated
    setSnapshot(updated)
  }, [readContract, readErc20, readSocialProfile])

  const retryCoreStateAfterWrite = useCallback(async (user: Address) => {
    // A confirmed receipt-block read should already be authoritative. These
    // follow-up latest-state reads protect against RPC edges that briefly lag
    // immediately after confirmation without blocking the transaction UI.
    for (const delayMs of [350, 1000, 2000]) {
      await sleep(delayMs)
      if (!accountRef.current || !sameAddress(accountRef.current, user)) return
      try {
        await refreshCoreStateOnly(user)
      } catch (error) {
        console.warn(`Post-transaction balance refresh retry after ${delayMs}ms failed.`, error)
      }
    }
  }, [refreshCoreStateOnly])

  // Match-changing writes refresh balance and match state together. The two run
  // sequentially per tick (not concurrently) because each does a non-atomic
  // read-modify-write on the snapshot and would otherwise race. Match reads are
  // pinned to the confirmed receipt block so a lagging RPC "latest" can never
  // reintroduce pre-transaction queue/match state.
  const retryBalanceAndMatchAfterWrite = useCallback(async (user: Address, matchBlockNumber?: bigint) => {
    for (const delayMs of [350, 1000, 2000]) {
      await sleep(delayMs)
      if (!accountRef.current || !sameAddress(accountRef.current, user)) return
      try {
        await refreshCoreStateOnly(user)
        await refreshMatchStateOnly(user, matchBlockNumber)
      } catch (error) {
        console.warn(`Post-transaction balance/match refresh retry after ${delayMs}ms failed.`, error)
      }
    }
  }, [refreshCoreStateOnly, refreshMatchStateOnly])

  const refreshAfterWrite = useCallback(async (action: ActionName, args: readonly unknown[]) => {
    if (!account) return
    await loadConfig()

    const other = String(args[0] ?? '')
    const isChallengeAction = [
      'stakeForFriendship',
      'depositAndStakeForFriendship',
      'cancelPendingStake',
      'rejectPendingStake',
      'steal',
      'finalizeFriendship',
    ].includes(action)

    if (!isChallengeAction || !isAddressLike(other)) return

    try {
      const challenge = await readChallengeViewForOther(account, other as Address)
      const terminal = ['cancelPendingStake', 'rejectPendingStake', 'steal', 'finalizeFriendship'].includes(action)

      if (!challenge) {
        if (terminal) removeChallengeFromSnapshot(other as Address)
        return
      }

      upsertChallengeInSnapshot(challenge)
    } catch (error) {
      console.warn('Targeted challenge refresh failed.', error)
    }
  }, [account, loadConfig, readChallengeViewForOther, removeChallengeFromSnapshot, upsertChallengeInSnapshot])

  // Shared post-confirmation work for contract writes.
  const finishWrite = useCallback(async (
    action: ActionName,
    args: readonly unknown[],
    label: string,
    hash: `0x${string}`,
  ) => {
    const writer = accountRef.current
    if (!writer) return

    const receipt = await waitForSuccessfulReceipt(hash)

    const balanceChanging = [
      'deposit',
      'withdraw',
      'fundBonusPool',
      'stakeForFriendship',
      'depositAndStakeForFriendship',
      'cancelPendingStake',
      'rejectPendingStake',
      'steal',
      'finalizeFriendship',
      'matchMe',
      'depositAndMatchMe',
      'cancelMatchMe',
      'cleanupMyExpiredMatch',
    ].includes(action)

    const matchChanging = [
      'matchMe',
      'depositAndMatchMe',
      'cancelMatchMe',
      'cleanupMyExpiredMatch',
    ].includes(action)

    // Balance- and match-changing writes must update authoritative RPC state
    // before the action resolves. This keeps the top bar, wallet sheet, and
    // matchmaking hero in sync with the confirmed receipt instead of waiting
    // for the detached subgraph poll (which lags block confirmation).
    //
    // These two refreshes run sequentially, not in parallel: each does a
    // non-atomic read-modify-write on snapshotRef.current (spread the current
    // snapshot, overwrite its own fields, write it back). Run concurrently they
    // race — whichever resolves last spreads a stale base and clobbers the
    // other's fields. In practice the match refresh short-circuits fast when
    // cancelling (not in queue, no match), lost the race to the slower balance
    // refresh, and left the hero stuck on "Searching" until a manual refresh.
    if (balanceChanging || matchChanging) {
      try {
        // Read at the confirmed receipt block so the UI cannot observe a
        // pre-transaction "latest" value from a lagging RPC edge.
        if (balanceChanging) await refreshCoreStateOnly(writer, receipt.blockNumber)
        if (matchChanging) await refreshMatchStateOnly(writer, receipt.blockNumber)
      } catch (error) {
        console.warn('Confirmed state refresh at receipt block failed; retrying latest state.', error)
        if (balanceChanging) {
          await refreshCoreStateOnly(writer).catch((retryError) => {
            console.warn('Confirmed balance refresh retry failed.', retryError)
          })
        }
        if (matchChanging) {
          await refreshMatchStateOnly(writer).catch((retryError) => {
            console.warn('Confirmed match-state refresh retry failed.', retryError)
          })
        }
      }
    }

    setTx({ pending: false, label, success: successMessage(action, args) })

    const graphTracked = [
      'deposit',
      'withdraw',
      'stakeForFriendship',
      'depositAndStakeForFriendship',
      'cancelPendingStake',
      'rejectPendingStake',
      'steal',
      'finalizeFriendship',
      'matchMe',
      'depositAndMatchMe',
      'cancelMatchMe',
      'cleanupMyExpiredMatch',
    ].includes(action)

    void (async () => {
      await Promise.all([
        matchChanging
          ? retryBalanceAndMatchAfterWrite(writer, receipt.blockNumber)
          : balanceChanging
            ? retryCoreStateAfterWrite(writer)
            : refreshCoreStateOnly(writer).catch(() => undefined),
        refreshAfterWrite(action, args).catch(() => undefined),
      ])
      if (graphTracked) await pollGraphForTransaction(writer, hash, matchChanging ? receipt.blockNumber : undefined)
    })()
  }, [pollGraphForTransaction, refreshAfterWrite, refreshCoreStateOnly, refreshMatchStateOnly, retryBalanceAndMatchAfterWrite, retryCoreStateAfterWrite])

  const write = useCallback(async (action: ActionName, args: readonly unknown[] = [], label = 'Confirm transaction'): Promise<boolean> => {
    if (appConfig.isMockMode) {
      setTx({ pending: false, label: '', success: `${label} simulated in mock mode.` })
      return true
    }
    if (!account) {
      setTx({ pending: false, label: '', error: 'Connect your wallet first.' })
      return false
    }
    if (!walletClient) {
      // A connected wallet can still yield no client (client query not yet
      // resolved, or an unsupported chain slipped past the pinned hook), so
      // ask for the network switch rather than claiming it is disconnected.
      if (isConnected) {
        try {
          await switchChainAsync({ chainId: appConfig.chainId })
          setTx({ pending: false, label: '', error: `Wallet switched to ${appConfig.chainName} — tap the button again.` })
        } catch {
          setTx({ pending: false, label: '', error: `Open your wallet and switch to ${appConfig.chainName}, then try again.` })
        }
        return false
      }
      setTx({ pending: false, label: '', error: 'Connect your wallet first.' })
      return false
    }

    // A newer write supersedes any older transaction-index polling loop.
    graphPollSeqRef.current += 1

    try {
      await ensureWalletChain()
      const usdcAmount = getUsdcAmountForAction(action, args)

      if (typeof usdcAmount === 'bigint') await ensureUsdcAllowance(usdcAmount)

      setTx({ pending: true, label })
      let hash: `0x${string}`
      if (action === 'approveUsdc') {
        hash = await walletClient.writeContract({
          account,
          address: appConfig.usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          chain: configuredChain,
          args: [appConfig.contractAddress, maxUint256],
        })
      } else if (action === 'setProfile') {
        if (!appConfig.hasProfiles) throw new Error('Set VITE_PROFILES_ADDRESS before editing profiles.')
        hash = await walletClient.writeContract({
          account,
          address: appConfig.profilesAddress,
          abi: socialTrustProfilesAbi,
          functionName: 'setProfile',
          chain: configuredChain,
          args: args as never,
        })
      } else {
        hash = await walletClient.writeContract({
          account,
          address: appConfig.contractAddress,
          abi: socialTrustAbi,
          functionName: action as never,
          chain: configuredChain,
          args: args as never,
        })
      }

      await finishWrite(action, args, label, hash)

      return true
    } catch (error) {
      setTx({ pending: false, label: '', error: txErrorMessage(error) })
      await refresh().catch(() => undefined)
      return false
    }
  }, [account, ensureUsdcAllowance, ensureWalletChain, finishWrite, isConnected, refresh, switchChainAsync, walletClient])

  // Replace a single profile field without ever hand-building a full profile at
  // the call site. Because setProfile overwrites all five fields, we read the
  // caller's current profile fresh from chain (never a stale query cache),
  // replace only the target field, and write the merged whole back.
  const submitProfileField = useCallback(async (field: ProfileField, rawValue: string): Promise<boolean | void> => {
    if (!account) return setTx({ pending: false, label: '', error: 'Connect your wallet first.' })
    if (!appConfig.hasProfiles) return setTx({ pending: false, label: '', error: 'Set VITE_PROFILES_ADDRESS before editing profiles.' })

    const value = normalizeProfileField(field, rawValue)
    if (!value) return setTx({ pending: false, label: '', error: `${PROFILE_FIELD_LABEL[field]} can't be empty.` })

    const fieldError = validateProfileField(field, value)
    if (fieldError) return setTx({ pending: false, label: '', error: fieldError })

    const current = await readSocialProfile(account)
    const merged: SocialProfile = { ...current, [field]: value }
    return write('setProfile', profileToArgs(merged), 'Save profile')
  }, [account, readSocialProfile, write])

  const actions = useMemo(() => ({
    approveUsdc: () => write('approveUsdc', [], 'Approve USDC'),
    deposit: (amount: string) => write('deposit', [parseUsdc(amount)], 'Deposit USDC'),
    withdraw: (amount: string) => write('withdraw', [parseUsdc(amount)], 'Withdraw USDC'),
    fundBonusPool: (amount: string) => write('fundBonusPool', [parseUsdc(amount)], 'Fund bonus pool'),
    stakeForFriendship: async (other: string) => {
      if (!isAddressLike(other)) {
        setTx({ pending: false, label: '', error: 'Enter a valid wallet address.' })
        return false
      }
      return write('stakeForFriendship', [other], 'Stake for friendship')
    },
    depositAndStakeForFriendship: async (other: string, amount: string) => {
      if (!isAddressLike(other)) {
        setTx({ pending: false, label: '', error: 'Enter a valid wallet address.' })
        return false
      }
      return write('depositAndStakeForFriendship', [other, parseUsdc(amount)], 'Deposit and stake')
    },
    cancelPendingStake: (other: Address) => write('cancelPendingStake', [other], 'Cancel pending stake'),
    rejectPendingStake: (staker: Address) => write('rejectPendingStake', [staker], 'Reject pending stake'),
    steal: (other: Address) => write('steal', [other], 'Steal pot'),
    finalizeFriendship: (other: Address) => write('finalizeFriendship', [other], 'Finalize friendship'),
    matchMe: () => write('matchMe', [], 'Find a match'),
    depositAndMatchMe: (amount: string) => write('depositAndMatchMe', [parseUsdc(amount)], 'Deposit and find match'),
    cancelMatchMe: () => write('cancelMatchMe', [], 'Cancel matchmaking'),
    cleanupMyExpiredMatch: () => write('cleanupMyExpiredMatch', [], 'Clear expired match'),
    setChallengeConfig: (values: { stakeAmt: string; cancelFee: string; rejectFee: string; durationSeconds: string; graceSeconds: string; stealBounty: string; friendshipSuccessFee: string }) => {
      const stakeAmt = parseUsdc(values.stakeAmt)
      const cancelFee = parseUsdc(values.cancelFee)
      const rejectFee = parseUsdc(values.rejectFee)
      const challengeDuration = BigInt(Math.floor(Number(values.durationSeconds || '0')))
      const stealGracePeriod = BigInt(Math.floor(Number(values.graceSeconds || '0')))
      const stealBounty = parseUsdc(values.stealBounty)
      const friendshipSuccessFee = parseUsdc(values.friendshipSuccessFee)

      if (challengeDuration <= 0n) return setTx({ pending: false, label: '', error: 'Challenge duration must be greater than 0 seconds.' })
      if (stealGracePeriod >= challengeDuration) return setTx({ pending: false, label: '', error: 'Steal grace must be less than challenge duration.' })
      if (stakeAmt <= 0n) return setTx({ pending: false, label: '', error: 'Stake amount must be greater than 0 USDC.' })
      if (stealBounty <= stakeAmt) return setTx({ pending: false, label: '', error: 'Steal bounty must be greater than the stake amount.' })
      if (stealBounty >= stakeAmt * 2n) return setTx({ pending: false, label: '', error: 'Steal bounty must be less than 2x the stake amount.' })
      if (friendshipSuccessFee >= stakeAmt) return setTx({ pending: false, label: '', error: 'Success fee must be less than the stake amount.' })

      return write('setChallengeConfig', [
        stakeAmt,
        cancelFee,
        rejectFee,
        challengeDuration,
        stealGracePeriod,
        stealBounty,
        friendshipSuccessFee,
      ], 'Save challenge settings')
    },
    setBonusConfig: (values: { payoutBps: string; maxTreasurySpendBps: string; maxBonusPerSuccess: string }) => write('setBonusConfig', [
      BigInt(values.payoutBps || '0'),
      BigInt(values.maxTreasurySpendBps || '0'),
      parseUsdc(values.maxBonusPerSuccess),
    ], 'Save bonus settings'),
    setScore: (userAddress: string, score: string) => {
      if (!isAddressLike(userAddress)) return setTx({ pending: false, label: '', error: 'Enter a valid wallet address.' })
      return write('setScore', [userAddress, BigInt(score || '0')], 'Set reputation score')
    },
    // Full multi-field save used by the profile edit sheet. It legitimately
    // sets every field the sheet exposes, but reads the current profile fresh
    // to preserve fields the sheet does not manage (e.g. Discord) instead of
    // blanking them.
    setProfile: async (values: { displayName: string; xUsername: string; telegramUsername: string; imgUrl: string }) => {
      if (!account) return setTx({ pending: false, label: '', error: 'Connect your wallet first.' })
      if (!appConfig.hasProfiles) return setTx({ pending: false, label: '', error: 'Set VITE_PROFILES_ADDRESS before editing profiles.' })

      const displayName = normalizeProfileField('displayName', values.displayName)
      const xUsername = normalizeProfileField('xUsername', values.xUsername)
      const telegramUsername = normalizeProfileField('telegramUsername', values.telegramUsername)
      const imgUrl = normalizeProfileField('imgUrl', values.imgUrl)

      for (const [field, value] of [
        ['displayName', displayName],
        ['xUsername', xUsername],
        ['telegramUsername', telegramUsername],
        ['imgUrl', imgUrl],
      ] as const) {
        const error = validateProfileField(field, value)
        if (error) return setTx({ pending: false, label: '', error })
      }

      const current = await readSocialProfile(account)
      return write('setProfile', [displayName, xUsername, telegramUsername, current.discordUsername, imgUrl], 'Save profile')
    },
    // Per-field helpers. Every single-field profile update must go through one
    // of these so no call site hand-builds a full profile (and risks blanking
    // the others).
    setDisplayName: (name: string) => submitProfileField('displayName', name),
    setXUsername: (handle: string) => submitProfileField('xUsername', handle),
    setTelegramUsername: (handle: string) => submitProfileField('telegramUsername', handle),
    setDiscordUsername: (handle: string) => submitProfileField('discordUsername', handle),
    setImgUrl: (url: string) => submitProfileField('imgUrl', url),
  }), [account, readSocialProfile, submitProfileField, write])

  return {
    account,
    connectedWallet,
    isConnected,
    isMockMode: appConfig.isMockMode,
    isLoading,
    isOwner,
    wrongNetwork,
    config,
    snapshot,
    tx,
    connect,
    disconnect,
    switchToAppNetwork,
    refresh,
    readAccountProfile,
    actions,
    clearTx: () => setTx({ pending: false, label: '' }),
  }
}
