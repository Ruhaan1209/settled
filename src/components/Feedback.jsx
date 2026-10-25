import { useState } from 'react'
import { submitFeedback } from '../lib/room'

export default function Feedback() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await submitFeedback(message.trim(), contact.trim())
      setSent(true)
      setMessage('')
      setContact('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return <p className="feedback-thanks">Thanks, got it. We'll take a look.</p>
  }

  if (!open) {
    return (
      <button type="button" className="feedback-link" onClick={() => setOpen(true)}>
        Something not working? Let us know
      </button>
    )
  }

  return (
    <form className="feedback" onSubmit={handleSubmit}>
      <h2 className="section-title">Report a problem or send feedback</h2>
      <textarea
        className="input textarea"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value)
          setError('')
        }}
        placeholder="What happened? What were you trying to do?"
        maxLength={2000}
        rows={4}
        autoFocus
        aria-label="Message"
      />
      <input
        className="input"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Email for a reply (optional)"
        maxLength={200}
        autoComplete="email"
        aria-label="Contact (optional)"
      />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="feedback-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!message.trim() || sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
