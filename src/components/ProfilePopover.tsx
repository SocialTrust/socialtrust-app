import { useEffect, useRef, useState } from 'react'
import { Copy, Pencil, X } from 'lucide-react'
import type { Address } from 'viem'
import type { SocialProfile } from '../types'
import { copyText, shortAddress } from '../lib/format'
import { displayNameFor } from './ProfileAvatar'

type ProfilePopoverProps = {
  account: Address
  profile?: SocialProfile
  onEditProfile: () => void
  onClose: () => void
}

function profileText(value?: string, formatter?: (value: string) => string) {
  const clean = value?.trim()
  if (!clean) return 'Not set'
  return formatter ? formatter(clean) : clean
}

export function ProfilePopover({ account, profile, onEditProfile, onClose }: ProfilePopoverProps) {
  const name = profile?.displayName?.trim() || displayNameFor(account, profile)
  const popoverRef = useRef<HTMLElement>(null)
  const copiedTimerRef = useRef<number | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target)) return

      // Let the avatar button handle its own open/close toggle.
      if (target instanceof Element && target.closest('.profileButton')) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
    }
  }, [onClose])

  const handleCopyAddress = async () => {
    await copyText(account)
    setCopied(true)
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <section ref={popoverRef} className="profilePopover" role="dialog" aria-label="Profile details">
      <div className="profilePopoverHeader">
        <div className="profilePopoverIdentity">
          <strong>{name}</strong>
          <span>
            {shortAddress(account, 6)}
            <button
              className={`copyIconButton profileCopyButton ${copied ? 'copied' : ''}`}
              onClick={handleCopyAddress}
              aria-label={copied ? 'Address copied' : 'Copy address'}
              title={copied ? 'Copied' : 'Copy address'}
            >
              {copied ? <span>✓ Copied</span> : <Copy size={14} />}
            </button>
          </span>
        </div>
        <button className="profilePopoverClose" onClick={onClose} aria-label="Close profile menu" title="Close">
          <X size={17} />
        </button>
      </div>
      <div className="profilePopoverRows">
        <div>
          <span>X</span>
          <strong>{profileText(profile?.xUsername, (value) => `@${value}`)}</strong>
        </div>
        <div>
          <span>Telegram</span>
          <strong>{profileText(profile?.telegramUsername, (value) => `@${value}`)}</strong>
        </div>
      </div>
      <button
        className="secondaryButton full profilePopoverEdit"
        onClick={() => {
          onClose()
          onEditProfile()
        }}
      >
        <Pencil size={15} /> Edit profile
      </button>
    </section>
  )
}
