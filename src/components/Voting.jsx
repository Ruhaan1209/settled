import { useEffect, useMemo, useRef, useState } from 'react'
import SwipeCard from './SwipeCard'
import { CATEGORIES, castVote, endVoting, finishVoting } from '../lib/room'

export default function Voting({ room, participants, options, votes, me, isHost, refresh }) {
  const category = CATEGORIES[room.category]
  const [localVotes, setLocalVotes] = useState({})
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [ending, setEnding] = useState(false)
  const pending = useRef(new Set())
  const finishStarted = useRef(false)

  // Server votes cover a page reload mid-round; local votes make taps instant
  const myVotes = useMemo(() => {
    const mine = {}
    for (const v of votes) if (v.participant_id === me?.id) mine[v.option_id] = v.value
    return { ...mine, ...localVotes }
  }, [votes, me, localVotes])

  const remaining = options.filter((o) => !(o.id in myVotes))
  const allVoted = remaining.length === 0
  const iAmDone = Boolean(me && me.done_round >= room.round)
  const doneCount = participants.filter((p) => p.done_round >= room.round).length

  function handleVote(option, value) {
    setError('')
    setLocalVotes((prev) => ({ ...prev, [option.id]: value }))
    const request = castVote(option.id, value).catch((err) => {
      // Put the card back so they can try again
      setLocalVotes((prev) => {
        const next = { ...prev }
        delete next[option.id]
        return next
      })
      setError(err.message)
      throw err
    })
    pending.current.add(request)
    request.finally(() => pending.current.delete(request)).catch(() => {})
  }

  // Once every card is answered and saved, tell the server this person is done
  useEffect(() => {
    if (!allVoted || iAmDone || finishStarted.current) return
    finishStarted.current = true
    ;(async () => {
      try {
        await Promise.all([...pending.current])
        await finishVoting(room.id)
        refresh()
      } catch (err) {
        finishStarted.current = false
        setError(err.message)
      }
    })()
  }, [allVoted, iAmDone, room.id, refresh, attempt])

  async function handleEnd() {
    setEnding(true)
    setError('')
    try {
      await endVoting(room.id)
      refresh()
    } catch (err) {
      setError(err.message)
      setEnding(false)
    }
  }

  if (allVoted || iAmDone) {
    return (
      <div className="screen voting">
        <header className="room-header">
          <p className="eyebrow">{category.label}</p>
          <h1 className="title">You're done.</h1>
          <p className="muted">
            Waiting for everyone else · {doneCount} of {participants.length} finished
          </p>
        </header>

        <ul className="done-list">
          {participants.map((p) => {
            const done = p.done_round >= room.round
            return (
              <li key={p.id} className={`done-row${done ? ' is-done' : ''}`}>
                <span>{p.name}{p.id === me?.id && ' (you)'}</span>
                <span className="done-mark">{done ? 'Done' : 'Still voting'}</span>
              </li>
            )
          })}
        </ul>

        {error && (
          <div className="section">
            <p className="error" role="alert">{error}</p>
            <button className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </div>
        )}

        <footer className="sticky-footer">
          {isHost ? (
            <>
              <button className="btn btn-secondary btn-block" onClick={handleEnd} disabled={ending}>
                {ending ? 'Ending…' : 'End voting now'}
              </button>
              <p className="muted hint">Use this if someone has wandered off</p>
            </>
          ) : (
            <p className="muted hint">Results appear as soon as everyone's done</p>
          )}
        </footer>
      </div>
    )
  }

  const current = remaining[0]
  const position = options.length - remaining.length + 1

  return (
    <div className="screen voting">
      <header className="room-header">
        <p className="eyebrow">{category.label}</p>
        <div className="progress-row">
          <span className="muted">{position} of {options.length}</span>
          <div className="progress" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${((position - 1) / options.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <SwipeCard
        key={current.id}
        label={current.label}
        nextLabel={remaining[1]?.label}
        onVote={(value) => handleVote(current, value)}
      />

      {error && <p className="error center-text" role="alert">{error}</p>}
      <p className="muted hint">Swipe right for yes, left for no</p>
    </div>
  )
}
