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
        <h1 className="logo">Settled</h1>
        <p className="tagline">End the group chat debate in under 2 minutes.</p>
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

      <div className="choices">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`choice choice-${key}`}
            onClick={() => handleCreate(key)}
            disabled={busy !== null || !isConfigured}
          >
            <span className="choice-emoji" aria-hidden="true">{cat.emoji}</span>
            <span className="choice-label">{busy === key ? 'Creating room…' : cat.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="divider"><span>or join a friend's room</span></div>

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
