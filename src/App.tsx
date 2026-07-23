import { useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { formatUsdc, isAddressLike } from './lib/format'
import type { ChallengeView } from './types'
import { useSocialTrust } from './hooks/useSocialTrust'
import { useLiveNow } from './hooks/useLiveNow'
import { HomePage } from './pages/HomePage'
import { AccountPage } from './pages/AccountPage'
import { StartFriendshipSheet } from './components/StartFriendshipSheet'
import { WalletSheet } from './components/WalletSheet'
import { ChallengeDetailSheet } from './components/ChallengeDetailSheet'
import { AdminSheet } from './components/AdminSheet'
import { Toast } from './components/Toast'
import { MainMenuSheet } from './components/MainMenuSheet'
import { MoreHorizontal, ScanLine } from 'lucide-react'
import { ProfileAvatar } from './components/ProfileAvatar'
import { ProfilePopover } from './components/ProfilePopover'
import { ProfileEditSheet } from './components/ProfileEditSheet'

function getPath() {
  return window.location.pathname || '/'
}

function App() {
  const {
    account,
    connectedWallet,
    isConnected,
    isMockMode,
    isLoading,
    isOwner,
    config,
    snapshot,
    tx,
    connect,
    disconnect,
    refresh,
    readAccountProfile,
    actions,
    clearTx,
  } = useSocialTrust()

  const [path, setPath] = useState(getPath())
  const [startOpen, setStartOpen] = useState(false)
  const [startOther, setStartOther] = useState<string | undefined>()
  const [walletOpen, setWalletOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [selectedChallengeKey, setSelectedChallengeKey] = useState<ChallengeView['pairKey'] | undefined>()
  const nowSeconds = useLiveNow()

  useEffect(() => {
    const onPop = () => setPath(getPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to: string) => {
    window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const route = useMemo(() => {
    if (path === '/') return { name: 'home' as const }
    if (path === '/me') return { name: 'me' as const }
    const match = path.match(/^\/account\/(0x[a-fA-F0-9]{40})$/)
    if (match && isAddressLike(match[1])) return { name: 'account' as const, address: match[1] as Address }
    return { name: 'not-found' as const }
  }, [path])

  const routeAddress = route.name === 'me' ? account : route.name === 'account' ? route.address : undefined

  const selectedChallenge = useMemo(() => {
    if (!selectedChallengeKey) return undefined
    return snapshot?.challenges.find((challenge) => challenge.pairKey.toLowerCase() === selectedChallengeKey.toLowerCase())
  }, [selectedChallengeKey, snapshot?.challenges])

  useEffect(() => {
    if (selectedChallengeKey && snapshot && !selectedChallenge) setSelectedChallengeKey(undefined)
  }, [selectedChallenge, selectedChallengeKey, snapshot])

  const openChallenge = (challenge: ChallengeView) => setSelectedChallengeKey(challenge.pairKey)

  const topBarBalance = formatUsdc(snapshot?.appBalance, { compact: true })
  const topBarRep = String(snapshot?.repScore ?? 0n)

  const finalize = (challenge: ChallengeView) => actions.finalizeFriendship(challenge.other)
  const accept = (challenge: ChallengeView) => {
    const appBalance = snapshot?.appBalance ?? 0n
    const missingStake = challenge.stakeAmount > appBalance ? challenge.stakeAmount - appBalance : 0n
    if (missingStake > 0n) return actions.depositAndStakeForFriendship(challenge.other, formatUsdc(missingStake))
    return actions.stakeForFriendship(challenge.other)
  }
  const reject = (challenge: ChallengeView) => actions.rejectPendingStake(challenge.other)
  const cancel = (challenge: ChallengeView) => actions.cancelPendingStake(challenge.other)
  const steal = (challenge: ChallengeView) => actions.steal(challenge.other)

  const startWith = (address?: string) => {
    setStartOther(address)
    setStartOpen(true)
  }

  return (
    <main className="appShell">
      <header className={`topBar ${isConnected && route.name === 'home' ? 'connectedHomeTopBar' : ''}`}>
        {isConnected && account ? (
          route.name === 'home' ? (
            <>
              <div className="topBarLeft">
                <button
                  className="profileButton"
                  aria-label="Open profile details"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <ProfileAvatar address={account} profile={snapshot?.socialProfile} size="sm" />
                </button>
                <button className="scanButton" aria-label="Scan">
                  <ScanLine size={28} strokeWidth={1.75} />
                </button>
                <div className="topBarMetrics" aria-label="Account balance and reputation">
                  <span className="metricLine">
                    <span className="metricSymbol metricSymbolUsdc" aria-hidden="true">$</span>
                    <span className="metricValue">{topBarBalance}</span>
                  </span>
                  <span className="metricLine">
                    <span className="metricSymbol metricSymbolRep" aria-hidden="true">{'\u2605\uFE0E'}</span>
                    <span className="metricValue">{topBarRep}</span>
                  </span>
                </div>
                {profileOpen ? (
                  <ProfilePopover
                    account={account}
                    profile={snapshot?.socialProfile}
                    onEditProfile={() => setProfileEditOpen(true)}
                    onClose={() => setProfileOpen(false)}
                  />
                ) : null}
              </div>
              <div className="topBarRight">
                <button className="menuDots" aria-label="Open menu" onClick={() => setMenuOpen(true)}><MoreHorizontal size={22} /></button>
              </div>
            </>
          ) : (
            <>
              <button className="brandWordmark" onClick={() => navigate('/')}>SocialTrust</button>
              <div className="topBarRight">
                <button className="menuDots" aria-label="Open menu" onClick={() => setMenuOpen(true)}><MoreHorizontal size={22} /></button>
              </div>
            </>
          )
        ) : (
          <>
            <button className="brandWordmark" onClick={() => navigate('/')}>SocialTrust</button>
            <button className="walletButton" onClick={connect}>Connect wallet</button>
          </>
        )}
      </header>


      {route.name === 'home' ? (
        <HomePage
          account={account}
          isConnected={isConnected}
          config={config}
          snapshot={snapshot}
          isLoading={isLoading}
          onConnect={connect}
          onStart={() => startWith()}
          onStartWith={(address) => startWith(address)}
          onFindMatch={actions.matchMe}
          onCancelMatch={actions.cancelMatchMe}
          onCleanupExpiredMatch={actions.cleanupMyExpiredMatch}
          onOpenWallet={() => setWalletOpen(true)}
          txPending={tx.pending}
          onOpenChallenge={openChallenge}
          onFinalize={finalize}
          onAccept={accept}
          onReject={reject}
          onCancel={cancel}
          onNavigate={navigate}
          nowSeconds={nowSeconds}
        />
      ) : null}

      {route.name === 'me' || route.name === 'account' ? (
        <AccountPage
          address={routeAddress}
          connectedAccount={account}
          isConnected={isConnected}
          config={config}
          readAccountProfile={readAccountProfile}
          onConnect={connect}
          onBackHome={() => navigate('/')}
          onStartWith={startWith}
          onOpenChallenge={openChallenge}
          onOpenWallet={() => setWalletOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
          onSetProfile={actions.setProfile}
          onNavigate={navigate}
          nowSeconds={nowSeconds}
        />
      ) : null}

      {route.name === 'not-found' ? (
        <div className="emptyState pageEmpty">
          <h1>Page not found</h1>
          <p>Use / for Home, /me for your account, or /account/0x... for another account.</p>
          <button className="primaryButton" onClick={() => navigate('/')}>Go home</button>
        </div>
      ) : null}

      <StartFriendshipSheet
        open={startOpen}
        initialOther={startOther}
        config={config}
        snapshot={snapshot}
        isConnected={isConnected}
        onClose={() => setStartOpen(false)}
        onConnect={connect}
        onStake={actions.stakeForFriendship}
        onDepositAndStake={actions.depositAndStakeForFriendship}
      />

      <WalletSheet
        open={walletOpen}
        snapshot={snapshot}
        onClose={() => setWalletOpen(false)}
        onApprove={actions.approveUsdc}
        onDeposit={actions.deposit}
        onWithdraw={actions.withdraw}
        onFundBonusPool={actions.fundBonusPool}
      />

      <ChallengeDetailSheet
        challenge={selectedChallenge}
        onClose={() => setSelectedChallengeKey(undefined)}
        onFinalize={finalize}
        onAccept={accept}
        onReject={reject}
        onCancel={cancel}
        onSteal={steal}
        onNavigateAccount={(address) => {
          setSelectedChallengeKey(undefined)
          navigate(`/account/${address}`)
        }}
        nowSeconds={nowSeconds}
      />


      <MainMenuSheet
        open={menuOpen}
        account={account}
        isConnected={isConnected}
        isOwner={isOwner}
        config={config}
        onClose={() => setMenuOpen(false)}
        onConnect={connect}
        onDisconnect={disconnect}
        onOpenWallet={() => setWalletOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onNavigate={navigate}
      />

      <ProfileEditSheet
        open={profileEditOpen}
        profile={snapshot?.socialProfile}
        onClose={() => setProfileEditOpen(false)}
        onSave={actions.setProfile}
      />

      <AdminSheet
        open={adminOpen}
        config={config}
        onClose={() => setAdminOpen(false)}
        onSetChallengeConfig={actions.setChallengeConfig}
        onSetBonusConfig={actions.setBonusConfig}
        onSetScore={actions.setScore}
      />

      <Toast tx={tx} onClear={clearTx} />

      <button className="refreshFab" onClick={refresh}>{isLoading ? '…' : '↻'}</button>
    </main>
  )
}

export default App
