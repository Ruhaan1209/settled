import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, playAgain } from '../lib/room'

export default function Results({ room, participants, options, votes, isHost, refresh }) {
  const category = CATEGORIES[room.category]
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState('')

  const yesCount = {}
  for (const o of options) yesCount[o.id] = 0
  for (const v of votes) if (v.value && v.option_id in yesCount) yesCount[v.option_id] += 1
  const voterCount = new Set(votes.map((v) => v.participant_id)).size

  const winner = options.find((o) => o.id === room.winner_option_id)
  const winnerYes = winner ? yesCount[winner.id] : 0
  const tally = [...options].sort(
    (a, b) => (b.id === winner?.id) - (a.id === winner?.id) || yesCount[b.id] - yesCount[a.id],
  )
  const others = winner ? options.filter((o) => o.id !== winner.id && yesCount[o.id] === winnerYes) : []
  const tieText = others.length === 1 ? `Tied with ${others[0].label}` : `Tied with ${others.length} others`
  const host = participants.find((p) => p.user_id === room.host_id)

  async function handlePlayAgain() {
    setRestarting(true)
    setError('')
    try {
      await playAgain(room.id)
      refresh()
    } catch (err) {
      setError(err.message)
      setRestarting(false)
    }
  }

  return (
    <div className="screen results">
      <header className="room-header">
        <p className="eyebrow">{category.emoji} {category.label}</p>
        <h1 className="title">The group has spoken</h1>
      </header>

      {winner ? (
        <section className="winner-card">
          <span className="winner-kicker">Winner</span>
          <span className="winner-label">{winner.label}</span>
          <span className="winner-votes">
            {winnerYes} of {voterCount} said yes
          </span>
          {room.tie_broken && (
            <span className="tie-note">
              {winnerYes === 0
                ? '🎲 Nobody said yes to anything, so we picked at random'
                : `🎲 ${tieText}, picked at random`}
            </span>
          )}
        </section>
      ) : (
        <p className="muted">No winner this round.</p>
      )}

      <section className="section">
        <h2 className="section-title">All votes</h2>
        <ul className="tally">
          {tally.map((o) => (
            <li key={o.id} className={`tally-row${o.id === winner?.id ? ' is-winner' : ''}`}>
              <div className="tally-top">
                <span className="tally-label">{o.label}</span>
                <span className="tally-count">{yesCount[o.id]} yes</span>
              </div>
              <div className="progress" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ width: `${voterCount ? (yesCount[o.id] / voterCount) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <footer className="sticky-footer">
        {isHost ? (
          <button className="btn btn-primary btn-block" onClick={handlePlayAgain} disabled={restarting}>
            {restarting ? 'Starting…' : 'Play again'}
          </button>
        ) : (
          <p className="muted hint">{host?.name || 'The host'} can start another round</p>
        )}
        <Link className="btn btn-secondary btn-block" to="/">New room</Link>
      </footer>
    </div>
  )
}
