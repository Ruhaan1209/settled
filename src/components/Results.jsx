import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, playAgain } from '../lib/room'

const COUNT_MS = 1400

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Each part of the result fades in after the one before it
const stage = (seconds) => ({ animationDelay: `${seconds}s` })

export default function Results({ room, participants, options, votes, isHost, refresh }) {
  const category = CATEGORIES[room.category]
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState('')
  // Brief "counting votes" pause before the winner appears
  const [revealed, setRevealed] = useState(prefersReducedMotion)

  useEffect(() => {
    if (revealed) return
    const t = setTimeout(() => setRevealed(true), COUNT_MS)
    return () => clearTimeout(t)
  }, [revealed])

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
        <p className="eyebrow">{category.label}</p>
        <h1 className="title">Results</h1>
      </header>

      {!revealed ? (
        <div className="skeleton" role="status" aria-label="Counting votes">
          <span className="muted counting">Counting votes…</span>
          <div className="skeleton-line wide" />
          <div className="skeleton-line short" />
        </div>
      ) : winner ? (
        <section className="winner">
          <span className="winner-icon suspense" style={stage(0.2)} aria-hidden="true">✓</span>
          <div className="winner-body">
            <span className="eyebrow suspense" style={stage(0)}>And the winner is…</span>
            <span className="winner-label suspense suspense-slow" style={stage(0.6)}>{winner.label}</span>
            <span className="winner-votes suspense" style={stage(1.9)}>
              {winnerYes} of {voterCount} said yes
            </span>
            {room.tie_broken && (
              <span className="tie-note suspense" style={stage(2.3)}>
                {winnerYes === 0
                  ? 'Nobody said yes to anything, so it was picked at random.'
                  : `${tieText}, picked at random.`}
              </span>
            )}
          </div>
        </section>
      ) : (
        <p className="muted">No winner this round.</p>
      )}

      {revealed && (
        <section className="section suspense" style={stage(2.7)}>
          <h2 className="section-title">All votes</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Option</th>
                <th className="bar-cell" aria-hidden="true" />
                <th className="num">Yes</th>
              </tr>
            </thead>
            <tbody>
              {tally.map((o) => (
                <tr key={o.id} className={o.id === winner?.id ? 'is-winner' : undefined}>
                  <td>
                    {o.label}
                    {o.id === winner?.id && <span className="select-tag">Winner</span>}
                  </td>
                  <td className="bar-cell" aria-hidden="true">
                    <div className="progress">
                      <div
                        className="progress-fill"
                        style={{ width: `${voterCount ? (yesCount[o.id] / voterCount) * 100 : 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="num">{yesCount[o.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {revealed && (
        <footer className="sticky-footer suspense" style={stage(3.1)}>
          {isHost ? (
            <button className="btn btn-primary btn-block" onClick={handlePlayAgain} disabled={restarting}>
              {restarting ? 'Starting…' : 'Play again'}
            </button>
          ) : (
            <p className="muted hint">{host?.name || 'The host'} can start another round</p>
          )}
          <Link className="btn btn-secondary btn-block" to="/">New room</Link>
        </footer>
      )}
    </div>
  )
}
