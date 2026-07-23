import type { Address } from 'viem'
import { shortAddress } from '../lib/format'

type AddressLinkProps = {
  address: Address
  label?: string
  onNavigate: (path: string) => void
}

export function AddressLink({ address, label, onNavigate }: AddressLinkProps) {
  return (
    <button className="addressLink" onClick={() => onNavigate(`/account/${address}`)}>
      {label ?? shortAddress(address)}
    </button>
  )
}
