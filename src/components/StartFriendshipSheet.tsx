import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, QrCode, ScanLine } from 'lucide-react'
import jsQR from 'jsqr'
import { QRCodeSVG } from 'qrcode.react'
import type { Address } from 'viem'
import type { ContractConfig, SocialProfile, UserSnapshot } from '../types'
import { copyText, formatUsdc, formatUsdcOrDash, isAddressLike, sameAddress, secondsToLabelOrDash, shortAddress } from '../lib/format'
import { Sheet } from './Sheet'
import { ProfileAvatar, displayNameFor } from './ProfileAvatar'

type StartFriendshipSheetProps = {
  open: boolean
  initialOther?: string
  account?: string
  config?: ContractConfig
  snapshot?: UserSnapshot
  isConnected: boolean
  onClose: () => void
  onConnect: () => void
  onStake: (other: string) => Promise<boolean>
  onDepositAndStake: (other: string, amount: string) => Promise<boolean>
  /** Optional identity lookup for the entered/scanned account. */
  readSocialProfile?: (account: Address) => Promise<SocialProfile>
  /** Fired after a confirmed submission, just before the sheet closes. */
  onSubmitted?: () => void
}

type ScanState = 'idle' | 'starting' | 'active' | 'scanned' | 'error'

function extractAddress(payload: string): string | undefined {
  let candidate = payload.trim()
  if (candidate.toLowerCase().startsWith('ethereum:')) candidate = candidate.slice('ethereum:'.length)
  if (candidate.toLowerCase().startsWith('pay-')) candidate = candidate.slice('pay-'.length)
  candidate = candidate.split('@')[0].split('?')[0]
  return isAddressLike(candidate) ? candidate : undefined
}

export function StartFriendshipSheet({
  open,
  initialOther,
  account,
  config,
  snapshot,
  isConnected,
  onClose,
  onConnect,
  onStake,
  onDepositAndStake,
  readSocialProfile,
  onSubmitted,
}: StartFriendshipSheetProps) {
  const [tab, setTab] = useState<'scan' | 'show'>('scan')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [other, setOther] = useState(initialOther ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [otherProfile, setOtherProfile] = useState<SocialProfile | undefined>()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  // Generation counter: a getUserMedia that resolves after the sheet closed or
  // the tab switched must not attach its (still live) stream.
  const camGenRef = useRef(0)
  const copiedTimerRef = useRef<number | undefined>(undefined)
  // Guards a slow identity read from landing on a different address.
  const profileSeqRef = useRef(0)

  const stopCamera = () => {
    camGenRef.current += 1
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const tick = () => {
    const video = videoRef.current
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      const canvas = (canvasRef.current ??= document.createElement('canvas'))
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height)
        const address = code ? extractAddress(code.data) : undefined
        if (address) {
          setOther(address)
          stopCamera()
          setScanState('scanned')
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const startCamera = async () => {
    const gen = ++camGenRef.current
    setScanState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (gen !== camGenRef.current || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanState('active')
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setScanState('error')
    }
  }

  const switchTab = (next: 'scan' | 'show') => {
    stopCamera()
    setScanState((state) => (state === 'scanned' ? state : 'idle'))
    setTab(next)
  }

  useEffect(() => {
    if (open) {
      setOther(initialOther ?? '')
    } else {
      stopCamera()
      setTab('scan')
      setScanState('idle')
      setCopied(false)
      setOtherProfile(undefined)
      profileSeqRef.current += 1
    }
  }, [initialOther, open])

  useEffect(() => () => {
    stopCamera()
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
  }, [])

  const stake = config?.stakeAmt ?? 0n
  const appBalance = snapshot?.appBalance ?? 0n
  const missingStake = stake > appBalance ? stake - appBalance : 0n
  const hasEnough = Boolean(snapshot && appBalance >= stake)
  // Without the on-chain stake there is no correct deposit amount to compute,
  // so the action waits rather than submitting against a zero placeholder.
  const termsLoading = !config
  const otherValid = useMemo(() => isAddressLike(other) && !sameAddress(other, account), [other, account])
  const isSelf = useMemo(() => isAddressLike(other) && sameAddress(other, account), [other, account])

  // Identity preview for a valid counterparty. Display-only, so a failed read
  // falls back to the address instead of blocking the flow.
  useEffect(() => {
    if (!open || !otherValid || !readSocialProfile) {
      setOtherProfile(undefined)
      return
    }
    const target = other.trim() as Address
    const seq = ++profileSeqRef.current
    readSocialProfile(target)
      .then((profile) => {
        if (seq !== profileSeqRef.current) return
        setOtherProfile(profile)
      })
      .catch(() => {
        if (seq !== profileSeqRef.current) return
        setOtherProfile(undefined)
      })
  }, [open, other, otherValid, readSocialProfile])

  const submit = async () => {
    if (submitting || !otherValid || termsLoading) return
    setSubmitting(true)
    try {
      const success = hasEnough
        ? await onStake(other)
        : await onDepositAndStake(other, formatUsdc(missingStake))
      if (success) {
        onSubmitted?.()
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!account) return
    await copyText(account)
    setCopied(true)
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
  }

  const summary = otherValid ? (
    <div className="startSummary">
      <div className="startSummaryIdentity">
        <ProfileAvatar address={other} profile={otherProfile} size="sm" />
        <span className="startSummaryName">
          <strong>{displayNameFor(other, otherProfile)}</strong>
          <small>{shortAddress(other, 6)}</small>
        </span>
      </div>
      <dl className="factList">
        <div><dt>Stake required</dt><dd>{termsLoading ? formatUsdcOrDash(undefined) : `${formatUsdc(stake)} USDC`}</dd></div>
        <div><dt>Challenge length</dt><dd>{secondsToLabelOrDash(config?.challengeDuration)}</dd></div>
        <div><dt>Your app balance</dt><dd>{formatUsdc(appBalance)} USDC</dd></div>
        {hasEnough || termsLoading ? null : (
          <div><dt>Deposit needed</dt><dd>{formatUsdc(missingStake)} USDC from your wallet</dd></div>
        )}
      </dl>
    </div>
  ) : null

  const addressField = (
    <label className="fieldLabel">
      <span>{initialOther ? 'Their wallet address' : 'Or paste their wallet address'}</span>
      <input
        value={other}
        onChange={(event) => setOther(event.target.value)}
        placeholder="0x..."
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {isSelf ? <small className="fieldError">You cannot start a friendship with your own account.</small> : null}
    </label>
  )

  const footer = isConnected ? (
    <>
      <button className="primaryButton full" type="button" disabled={!otherValid || submitting || termsLoading} onClick={submit}>
        {submitting
          ? 'Confirming…'
          : termsLoading
            ? 'Loading terms…'
            : hasEnough ? `Stake ${formatUsdc(stake)} USDC` : `Deposit ${formatUsdc(missingStake)} USDC & stake`}
      </button>
      <p className="footerCaption">
        {termsLoading
          ? 'Reading the current stake and challenge length from the contract.'
          : hasEnough
            ? `${secondsToLabelOrDash(config?.challengeDuration)} challenge · app balance ${formatUsdc(appBalance)} USDC`
            : `Deposits ${formatUsdc(missingStake)} USDC from your wallet to cover the stake.`}
      </p>
    </>
  ) : null

  const scanning = scanState === 'starting' || scanState === 'active'

  return (
    <Sheet
      open={open}
      title="Start friendship"
      description="Stake with someone you know to begin a friendship challenge."
      onClose={onClose}
      busy={submitting}
      fullScreen={scanning}
      footer={footer}
    >
      {!isConnected ? (
        <div className="sheetEmpty">
          <h3>Connect first</h3>
          <p>You need a wallet to start a friendship challenge.</p>
          <button className="primaryButton full" type="button" onClick={onConnect}>Connect wallet</button>
        </div>
      ) : initialOther ? (
        <div className="formStack">
          {addressField}
          {summary}
        </div>
      ) : (
        <div className="formStack">
          <div className="segmentedControl">
            <button
              className={`segmentedOption ${tab === 'scan' ? 'active' : ''}`}
              type="button"
              aria-pressed={tab === 'scan'}
              onClick={() => switchTab('scan')}
            >
              <ScanLine size={15} aria-hidden="true" /> Scan their code
            </button>
            <button
              className={`segmentedOption ${tab === 'show' ? 'active' : ''}`}
              type="button"
              aria-pressed={tab === 'show'}
              onClick={() => switchTab('show')}
            >
              <QrCode size={15} aria-hidden="true" /> Show my code
            </button>
          </div>

          {tab === 'scan' ? (
            <>
              {scanState === 'scanned' ? (
                <div className="scanArea scanAreaDone">
                  <Check size={20} aria-hidden="true" />
                  <span>{shortAddress(other)}</span>
                  <button className="linkButton" type="button" onClick={() => { setScanState('idle'); setOther('') }}>Scan another</button>
                </div>
              ) : scanning ? (
                <div className="scanArea scanAreaActive">
                  <video ref={videoRef} className="scanVideo" playsInline muted autoPlay />
                  <button className="ghostButton small scanStop" type="button" onClick={() => { stopCamera(); setScanState('idle') }}>
                    Stop camera
                  </button>
                </div>
              ) : (
                <button type="button" className="scanArea" onClick={startCamera}>
                  <ScanLine size={28} aria-hidden="true" />
                  <span>Tap to scan their QR code</span>
                </button>
              )}
              {scanState === 'error' ? <p className="fieldError">Camera unavailable — paste the address below instead.</p> : null}

              {addressField}
              {summary}
            </>
          ) : (
            <div className="qrPanel">
              <div className="qrCard">
                <QRCodeSVG value={account ?? ''} size={172} />
              </div>
              <div className="qrAddressRow">
                <span>{shortAddress(account, 6)}</span>
                <button
                  className={`copyIconButton ${copied ? 'copied' : ''}`}
                  type="button"
                  onClick={handleCopy}
                  aria-label={copied ? 'Address copied' : 'Copy address'}
                  title={copied ? 'Copied' : 'Copy address'}
                >
                  {copied ? <span>✓ Copied</span> : <Copy size={15} />}
                </button>
              </div>
              <p className="quietCaption">Have them scan this to stake toward you. You will get an invite to stake back.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
