import type { SocialProfile } from '../types'
import { shortAddress } from '../lib/format'

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

export function ProfileAvatar({ profile, size = 'md', className = '' }: ProfileAvatarProps) {
  const imgUrl = profile?.imgUrl?.trim()
  const hasImage = Boolean(imgUrl)

  return (
    <span className={`profileAvatar profileAvatar-${size} ${hasImage ? 'profileAvatar-hasImage' : 'profileAvatar-empty'} ${className}`} aria-hidden="true">
      {hasImage ? <img src={imgUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
    </span>
  )
}
