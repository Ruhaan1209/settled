import { supabase, ensureSession } from './supabase'

const NAME_KEY = 'settled:name'

export const CATEGORIES = {
  eat: { label: 'Where to eat', sub: 'Restaurants', noun: 'restaurant', placeholder: 'Add a restaurant' },
  watch: { label: 'What to watch', sub: 'Movies and shows', noun: 'movie or show', placeholder: 'Add a movie or show' },
}

export function getSavedName() {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // private mode: name just won't be remembered
  }
}

export function roomUrl(code) {
  return `${window.location.origin}/r/${code}`
}

async function rpc(fn, args) {
  await ensureSession()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export function createRoom(category, name) {
  return rpc('create_room', { p_category: category, p_name: name })
}

export function joinRoom(code, name) {
  return rpc('join_room', { p_code: code, p_name: name })
}

export function addOption(roomId, label) {
  return rpc('add_option', { p_room_id: roomId, p_label: label })
}

export function removeOption(optionId) {
  return rpc('remove_option', { p_option_id: optionId })
}

export function startVoting(roomId) {
  return rpc('start_voting', { p_room_id: roomId })
}

export function castVote(optionId, value) {
  return rpc('cast_vote', { p_option_id: optionId, p_value: value })
}

export function finishVoting(roomId) {
  return rpc('finish_voting', { p_room_id: roomId })
}

export function endVoting(roomId) {
  return rpc('end_voting', { p_room_id: roomId })
}

export function playAgain(roomId) {
  return rpc('play_again', { p_room_id: roomId })
}

export function submitFeedback(message, contact) {
  return rpc('submit_feedback', {
    p_message: message,
    p_contact: contact,
    p_page: window.location.pathname,
    p_user_agent: navigator.userAgent,
  })
}
