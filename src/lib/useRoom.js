import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, ensureSession } from './supabase'
import { joinRoom } from './room'

// Joins a room and keeps its state in sync for everyone in it.
// Any realtime change triggers a full reload; rooms are tiny, so this keeps
// every phone consistent without merging individual events.
export function useRoom(code, name) {
  const [roomId, setRoomId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const loadSeq = useRef(0)

  useEffect(() => {
    let cancelled = false
    setError('')
    ;(async () => {
      try {
        const session = await ensureSession()
        const id = await joinRoom(code, name)
        if (cancelled) return
        setUserId(session.user.id)
        setRoomId(id)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, name])

  const refresh = useCallback(async () => {
    if (!roomId) return
    const seq = ++loadSeq.current
    const [roomRes, peopleRes, optionsRes] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('participants').select('*').eq('room_id', roomId).order('joined_at'),
      supabase.from('options').select('*').eq('room_id', roomId).eq('removed', false).order('created_at'),
    ])
    const failed = roomRes.error || peopleRes.error || optionsRes.error
    if (seq !== loadSeq.current) return
    if (failed) {
      setError(failed.message)
      return
    }

    const room = roomRes.data
    let votes = []
    if (room.status !== 'lobby') {
      const votesRes = await supabase.from('votes').select('*').eq('room_id', roomId).eq('round', room.round)
      if (seq !== loadSeq.current) return
      votes = votesRes.data || []
    }

    setData({
      room,
      participants: peopleRes.data,
      options: optionsRes.data.filter((o) => o.round === room.round),
      votes,
    })
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    refresh()

    const filter = (column) => ({ schema: 'public', filter: `${column}=eq.${roomId}` })
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', table: 'rooms', ...filter('id') }, refresh)
      .on('postgres_changes', { event: '*', table: 'participants', ...filter('room_id') }, refresh)
      .on('postgres_changes', { event: '*', table: 'options', ...filter('room_id') }, refresh)
      .subscribe((status) => {
        // Catch up on anything missed while connecting or reconnecting
        if (status === 'SUBSCRIBED') refresh()
      })

    // Phones pause background tabs; resync when the user comes back
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [roomId, refresh])

  const me = data?.participants.find((p) => p.user_id === userId) || null

  return {
    room: data?.room || null,
    participants: data?.participants || [],
    options: data?.options || [],
    votes: data?.votes || [],
    me,
    isHost: Boolean(data && data.room.host_id === userId),
    error,
    refresh,
  }
}
