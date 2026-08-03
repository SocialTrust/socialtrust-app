import type { CSSProperties } from 'react'
import type { SocialProfile } from '../types'
import { shortAddress } from '../lib/format'
import { profileImageSrc } from '../lib/profileImage'

type ProfileAvatarProps = {
  address?: string
  profile?: SocialProfile
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function displayNameFor(address?: string, profile?: SocialProfile) {
  const name = profile?.displayName?.trim()
  return name || shortAddress(address, 4)
}

export function secondaryNameFor(address?: string, profile?: SocialProfile) {
  return profile?.displayName?.trim() ? shortAddress(address, 4) : undefined
}

/** Deterministic hue from the address, so an account always looks the same. */
function hueFor(address?: string) {
  if (!address) return 150
  let hash = 0
  for (const char of address.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

function initialsFor(address?: string, profile?: SocialProfile) {
  const name = profile?.displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)
    return letters.toUpperCase()
  }
  if (address && address.length >= 4) return address.slice(2, 4).toUpperCase()
  return ''
}

export function ProfileAvatar({ address, profile, size = 'md', className = '' }: ProfileAvatarProps) {
  // Only a URL that would pass the save-time check is rendered. A profile
  // written before this rule, or by another client, falls back to the
  // deterministic default avatar rather than fetching from an arbitrary host.
  const imgUrl = profileImageSrc(profile?.imgUrl)
  const hasImage = Boolean(imgUrl)
  const style = hasImage ? undefined : ({ '--avatarHue': hueFor(address) } as CSSProperties)

  return (
    <span
      className={`profileAvatar profileAvatar-${size} ${hasImage ? 'profileAvatar-hasImage' : 'profileAvatar-empty'} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {hasImage
        ? <img src={imgUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <span className="avatarInitials">{initialsFor(address, profile)}</span>}
    </span>
  )
}
