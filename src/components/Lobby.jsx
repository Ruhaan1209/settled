import { useState } from 'react'
import ShareButton from './ShareButton'
import { CATEGORIES, addOption, removeOption, startVoting } from '../lib/room'

export default function Lobby({ room, participants, options, me, isHost, refresh }) {
  const category = CATEGORIES[room.category]
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const host = participants.find((p) => p.user_id === room.host_id)
  const nameById = Object.fromEntries(participants.map((p) => [p.id, p.name]))
  const canStart = options.length >= 2

  async function handleAdd(e) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed || adding) return
    setAdding(true)
    setError('')
    try {
      await addOption(room.id, trimmed)
      setLabel('')
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(optionId) {
    setError('')
    try {
      await removeOption(optionId)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      await startVoting(room.id)
      refresh()
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="screen lobby">
      <header className="room-header">
        <p className="eyebrow">{category.emoji} {category.label}</p>
        <h1 className="title">Room {room.code}</h1>
        <ShareButton code={room.code} className="btn btn-secondary" />
      </header>

      <section className="section">
        <h2 className="section-title">
          Who's in <span className="count">{participants.length}</span>
        </h2>
        <ul className="people">
          {participants.map((p) => (
            <li key={p.id} className={`person${p.id === me?.id ? ' person-me' : ''}`}>
              {p.name}
              {p.user_id === room.host_id && <span className="tag">host</span>}
              {p.id === me?.id && <span className="tag">you</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">
          Options <span className="count">{options.length}</span>
        </h2>
        <form className="add-row" onSubmit={handleAdd}>
          <input
            className="input"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              setError('')
            }}
            placeholder={category.placeholder}
            maxLength={80}
            enterKeyHint="send"
            aria-label={category.placeholder}
          />
          <button className="btn btn-primary add-btn" disabled={!label.trim() || adding} aria-label="Add option">
            +
          </button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}

        {options.length === 0 ? (
          <p className="muted empty">Nothing yet. Everyone can add {category.noun}s.</p>
        ) : (
          <ul className="options">
            {options.map((o) => (
              <li key={o.id} className="option">
                <div className="option-text">
                  <span className="option-label">{o.label}</span>
                  {nameById[o.added_by] && <span className="option-by">added by {nameById[o.added_by]}</span>}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleRemove(o.id)}
                  aria-label={`Remove ${o.label}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="sticky-footer">
        {isHost ? (
          <>
            <button className="btn btn-primary btn-block" onClick={handleStart} disabled={!canStart || starting}>
              {starting ? 'Starting…' : 'Start voting'}
            </button>
            {!canStart && <p className="muted hint">Add at least 2 options to start</p>}
          </>
        ) : (
          <p className="muted hint">Waiting for {host?.name || 'the host'} to start voting…</p>
        )}
      </footer>
    </div>
  )
}
