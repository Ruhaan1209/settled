import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 90
const EXIT_MS = 220

// One option card: drag right for yes, left for no, or use the buttons/arrow keys.
export default function SwipeCard({ label, nextLabel, onVote }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exit, setExit] = useState(0)
  const startX = useRef(null)
  const timer = useRef(null)

  function fling(dir) {
    if (exit) return
    setExit(dir)
    timer.current = setTimeout(() => onVote(dir > 0), EXIT_MS)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') fling(1)
      if (e.key === 'ArrowLeft') fling(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleDown(e) {
    if (exit) return
    startX.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleMove(e) {
    if (startX.current === null) return
    setDx(e.clientX - startX.current)
  }

  function handleUp() {
    if (startX.current === null) return
    startX.current = null
    setDragging(false)
    if (Math.abs(dx) > THRESHOLD) fling(Math.sign(dx))
    else setDx(0)
  }

  const transform = exit
    ? `translateX(${exit * 140}%) rotate(${exit * 18}deg)`
    : `translateX(${dx}px) rotate(${dx / 16}deg)`
  const lean = exit || Math.max(-1, Math.min(1, dx / THRESHOLD))

  return (
    <div className="swipe">
      <div className="card-stack">
        {nextLabel && (
          <div className="card card-behind" aria-hidden="true">
            <span className="card-label">{nextLabel}</span>
          </div>
        )}
        <div
          className="card"
          style={{ transform, transition: dragging ? 'none' : `transform ${EXIT_MS}ms ease` }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        >
          <span className="stamp stamp-yes" style={{ opacity: Math.max(0, lean) }}>Yes</span>
          <span className="stamp stamp-no" style={{ opacity: Math.max(0, -lean) }}>Nope</span>
          <span className="card-label">{label}</span>
        </div>
      </div>

      <div className="vote-buttons">
        <button type="button" className="vote-btn vote-no" onClick={() => fling(-1)} aria-label={`No to ${label}`}>
          No
        </button>
        <button type="button" className="vote-btn vote-yes" onClick={() => fling(1)} aria-label={`Yes to ${label}`}>
          Yes
        </button>
      </div>
    </div>
  )
}
