import { useState } from 'react'
import { roomUrl } from '../lib/room'

export default function ShareButton({ code, className = 'btn btn-primary' }) {
  const [copied, setCopied] = useState(false)
  const url = roomUrl(code)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Settled', text: 'Help us decide! Join my room:', url })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <button type="button" className={className} onClick={handleShare}>
      {copied ? 'Link copied!' : 'Share invite link'}
    </button>
  )
}
