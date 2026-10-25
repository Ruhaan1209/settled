import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Lobby from './Lobby'
import Voting from './Voting'
import Results from './Results'
import { getSavedName, saveName } from '../lib/room'
import { useRoom } from '../lib/useRoom'

export default function Room() {
  const { code: rawCode } = useParams()
  const code = rawCode.toUpperCase()
  const [name, setName] = useState(getSavedName)
  const [joinedName, setJoinedName] = useState(() => getSavedName() || null)

  function handleJoin(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    saveName(trimmed)
    setJoinedName(trimmed)
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

  return <RoomView code={code} name={joinedName} />
}

function RoomView({ code, name }) {
  const roomState = useRoom(code, name)
  const { room, error } = roomState

  if (error) {
    return (
      <div className="screen center">
        <p className="error" role="alert">{error}</p>
        <Link className="btn btn-secondary" to="/">Back home</Link>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="screen center">
        <p className="muted">Joining room…</p>
      </div>
    )
  }

  if (room.status === 'lobby') return <Lobby {...roomState} />
  if (room.status === 'voting') return <Voting key={room.round} {...roomState} />
  return <Results {...roomState} />
}
