import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES, getSavedName, joinRoom, roomUrl, saveName } from '../lib/room'

export default function Room() {
  const { code: rawCode } = useParams()
  const code = rawCode.toUpperCase()
  const [name, setName] = useState(getSavedName)
  const [joinedName, setJoinedName] = useState(() => getSavedName() || null)
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!joinedName) return
    let cancelled = false
    setError('')
    ;(async () => {
      try {
        const roomId = await joinRoom(code, joinedName)
        const { data, error: fetchError } = await supabase.from('rooms').select('*').eq('id', roomId).single()
        if (fetchError) throw fetchError
        if (!cancelled) setRoom(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, joinedName])

  function handleJoin(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    saveName(trimmed)
    setJoinedName(trimmed)
  }

  if (error) {
    return (
      <div className="screen center">
        <p className="error" role="alert">{error}</p>
        <Link className="btn btn-secondary" to="/">Back home</Link>
      </div>
    )
  }

  if (!joinedName) {
    return (
      <form className="screen center" onSubmit={handleJoin}>
        <h1 className="title">Join room {code}</h1>
        <label className="field">
          <span className="field-label">Your name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={24}
            autoFocus
            autoComplete="given-name"
            enterKeyHint="go"
          />
        </label>
        <button className="btn btn-primary" disabled={!name.trim()}>Join</button>
      </form>
    )
  }

  if (!room) {
    return (
      <div className="screen center">
        <p className="muted">Joining room…</p>
      </div>
    )
  }

  // Lobby, voting and results screens replace this next.
  const category = CATEGORIES[room.category]
  return (
    <div className="screen center">
      <p className="eyebrow">{category.emoji} {category.label}</p>
      <h1 className="title">Room {room.code}</h1>
      <ShareButton code={room.code} />
    </div>
  )
}

function ShareButton({ code }) {
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
    <button className="btn btn-primary" onClick={handleShare}>
      {copied ? 'Link copied!' : 'Share invite link'}
    </button>
  )
}
