import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured ? createClient(url, key) : null

let sessionPromise = null

// Every visitor gets an invisible anonymous account the first time they act.
// The session is kept in localStorage, so the same device stays the same user.
export function ensureSession() {
  if (!supabase) return Promise.reject(new Error('Supabase is not configured'))
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) return data.session
      const { data: signedIn, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return signedIn.session
    })().catch((err) => {
      sessionPromise = null
      throw err
    })
  }
  return sessionPromise
}
