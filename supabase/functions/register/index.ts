import { createClient } from 'npm:@supabase/supabase-js@2.117.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' })

  let input: { email?: unknown; password?: unknown; display_name?: unknown }
  try { input = await request.json() } catch { return reply(400, { error: 'Invalid request' }) }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const name = typeof input.display_name === 'string' ? input.display_name.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: 'Enter a valid email address' })
  if (password.length < 8 || password.length > 128) return reply(400, { error: 'Use a password between 8 and 128 characters' })
  if (name.length < 2 || name.length > 80) return reply(400, { error: 'Enter your full name' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return reply(500, { error: 'Registration is unavailable' })
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: name },
  })
  if (error) {
    const duplicate = error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')
    return reply(duplicate ? 409 : 400, { error: duplicate ? 'This email is already registered. Sign in instead.' : 'Unable to create account. Check your details and try again.' })
  }
  return reply(201, { ok: true })
})
