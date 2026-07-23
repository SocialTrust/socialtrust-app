import { useEffect, useState } from 'react'

export function useLiveNow(intervalMs = 1000) {
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const tick = () => setNowSeconds(Math.floor(Date.now() / 1000))
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return nowSeconds
}
