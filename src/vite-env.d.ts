/// <reference types="vite/client" />

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
  disconnect?: () => Promise<void>
}

type Eip6963ProviderInfo = {
  uuid: string
  name: string
  icon: string
  rdns: string
}

type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo
  provider: Eip1193Provider
}

type Eip6963AnnounceProviderEvent = CustomEvent<Eip6963ProviderDetail>

interface Window {
  ethereum?: Eip1193Provider & {
    providers?: Eip1193Provider[]
    isRabby?: boolean
    isMetaMask?: boolean
  }
}
