import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isConfigured } from '../lib/supabase'
import { CATEGORIES, createRoom, getSavedName, saveName } from '../lib/room'

export default function Home() {
  const navigate = useNavigate()
  const nameRef = useRef(null)
  const [name, setName] = useState(getSavedName)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  function handleJoin(e) {
    e.preventDefault()
    if (code.length < 6) return
    if (name.trim()) saveName(name.trim())
    navigate(`/r/${code}`)
  }

  async function handleCreate(category) {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter your name first')
      nameRef.current?.focus()
      return
    }
    setError('')
    setBusy(category)
    try {
      saveName(trimmed)
      const code = await createRoom(category, trimmed)
      navigate(`/r/${code}`)
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  return (
    <div className="screen home">
      <header className="home-header">
        <h1 className="logo">Settled.</h1>
        <p className="tagline">End the group chat debate.</p>
      </header>

      <label className="field">
        <span className="field-label">Your name</span>
        <input
          ref={nameRef}
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sam"
          maxLength={24}
          autoComplete="given-name"
          enterKeyHint="done"
        />
      </label>

      <div className="plan">
        <h2 className="plan-title">What's the plan?</h2>
        <p className="muted plan-sub">Pick one, share the room code, and everyone votes.</p>
      </div>

      <div className="choices">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`choice choice-${key}`}
            onClick={() => handleCreate(key)}
            disabled={busy !== null || !isConfigured}
          >
            <span className="choice-text">
              <span className="choice-label">{cat.label}</span>
              <span className="choice-sub">{busy === key ? 'Creating room…' : cat.sub}</span>
            </span>
            <span className="choice-arrow" aria-hidden="true">
              {key === 'eat' ? <EatIcon /> : <WatchIcon />}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="divider"><span>or join a room</span></div>

      <form className="add-row" onSubmit={handleJoin}>
        <input
          className="input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ROOM CODE"
          aria-label="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button className="btn btn-secondary" disabled={code.length < 6 || !isConfigured}>Join</button>
      </form>

      {!isConfigured && (
        <p className="notice">
          Supabase isn't connected yet. Copy <code>.env.example</code> to <code>.env.local</code> and add your keys.
        </p>
      )}
    </div>
  )
}

function EatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2 1-3 3.5-3 7h3" />
    </svg>
  )
}

function WatchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
    </svg>
  )
}
