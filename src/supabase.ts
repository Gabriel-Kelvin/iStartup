import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configured = Boolean(url && key)
export const supabase = createClient(url || 'https://invalid.supabase.co', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
export const publicSupabase = createClient(url || 'https://invalid.supabase.co', key || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

export type Project = {
  id: string
  name: string
  description: string
  team_members: string[]
  created_at: string
  updated_at: string
}
export type Profile = { id: string; display_name: string; role: 'judge' | 'admin' }
export type Score = { id: string; project_id: string; judge_id: string; value: number; submitted_at: string }
export type PublishedScore = { id: string; project_id: string; judge_id: string; value: number }
export type PublishedTotal = { project_id: string; value: number }
export type ScoreReveal = { project_id: string; judge_id: string; is_revealed: boolean }
