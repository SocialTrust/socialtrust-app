import type { Address, Hex } from 'viem'

export type ChallengeView = {
  pairKey: Hex
  account0: Address
  account1: Address
  other: Address
  stakeAmount: bigint
  cancelPendingStakeFee: bigint
  rejectPendingStakeFee: bigint
  challengeDuration: bigint
  stealGracePeriod: bigint
  stealBounty: bigint
  friendshipSuccessFee: bigint
  userStaked: boolean
  otherStaked: boolean
  active: boolean
  challengeStartedAt: bigint
  stealAllowedAt: bigint
  challengeEndsAt: bigint
}

export type ChallengeState =
  | 'pending-incoming'
  | 'pending-outgoing'
  | 'active-safe'
  | 'steal-open'
  | 'ready-finalize'
  | 'unknown'

export type SocialProfile = {
  displayName: string
  xUsername: string
  telegramUsername: string
  discordUsername: string
  imgUrl: string
  exists: boolean
}

export type MatchQueueState = {
  user: Address
  feeAmount: bigint
  cancelFeeAmount: bigint
  queuedAt: bigint
  status: 'QUEUED' | 'CANCELLED' | 'MATCHED' | string
  refundAmount?: bigint
  matchId?: bigint
}

export type MatchState = {
  id: string
  matchId: bigint
  user0: Address
  user1: Address
  feeAmount0: bigint
  feeAmount1: bigint
  matchedAt: bigint
  deadline: bigint
  status: 'ACTIVE' | 'SUCCEEDED' | 'EXPIRED' | string
  resolvedAt?: bigint
  feeRefund0?: bigint
  feeRefund1?: bigint
  amountToTreasury?: bigint
}

export type ContractConfig = {
  stakeAmt: bigint
  cancelPendingStakeFee: bigint
  rejectPendingStakeFee: bigint
  challengeDuration: bigint
  stealGracePeriod: bigint
  stealBounty: bigint
  friendshipSuccessFee: bigint
  payoutBps: bigint
  maxTreasurySpendBps: bigint
  maxBonusPerSuccess: bigint
  matchFee: bigint
  matchTimeLimit: bigint
  maxMatchScan: bigint
  matchQueueCancelFee: bigint
  bonusPool: bigint
  totalBonusPaid: bigint
  owner?: Address
}

export type ActivityKind =
  | 'deposit'
  | 'withdraw'
  | 'fund_bonus_pool'
  | 'stake'
  | 'invite'
  | 'challenge_started'
  | 'finalized'
  | 'stolen'
  | 'cancelled'
  | 'rejected'
  | 'bonus'
  | 'match'
  | 'transaction'

export type ActivityItem = {
  id: string
  kind: ActivityKind
  title: string
  detail?: string
  other?: Address
  amount?: bigint
  matchFeeRefund?: bigint
  timestamp?: bigint
  blockNumber?: bigint
  logIndex?: number
  pairKey?: Hex
  activityType?: number
  txHash?: Hex
}

export type UserSnapshot = {
  walletUsdc: bigint
  appBalance: bigint
  pendingBonus: bigint
  bonusPaidTo: bigint
  repScore: bigint
  allowance: bigint
  friendCount: bigint
  friends: Address[]
  challenges: ChallengeView[]
  recentActivity: ActivityItem[]
  owner?: Address
  socialProfile?: SocialProfile
  friendProfiles?: Record<string, SocialProfile>
  friendRepScores?: Record<string, bigint>
  currentQueueEntry?: MatchQueueState
  activeMatch?: MatchState
  matchPartnerProfile?: SocialProfile
}

/** A single-block, RPC-authoritative view of the connected user's matchmaking. */
export type MatchSnapshot = {
  blockNumber: bigint
  currentQueueEntry?: MatchQueueState
  activeMatch?: MatchState
  matchPartnerProfile?: SocialProfile
}

export type AccountProfile = {
  address: Address
  friendCount: bigint
  challengeCount: bigint
  repScore: bigint
  pendingBonus: bigint
  bonusPaidTo: bigint
  friends: Address[]
  challenges: ChallengeView[]
  appBalance?: bigint
  walletUsdc?: bigint
  allowance?: bigint
  owner?: Address
  isFriendWithViewer?: boolean
  relationshipChallenge?: ChallengeView
  socialProfile?: SocialProfile
  friendProfiles?: Record<string, SocialProfile>
  friendRepScores?: Record<string, bigint>
}

export type TransactionState = {
  pending: boolean
  label: string
  error?: string
  success?: string
}
