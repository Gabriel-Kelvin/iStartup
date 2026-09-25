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

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'Sign in as the admin to delete a judge.' })

  let input: { judge_id?: unknown }
  try { input = await request.json() } catch { return reply(400, { error: 'Invalid request.' }) }
  const judgeId = typeof input.judge_id === 'string' ? input.judge_id : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(judgeId)) {
    return reply(400, { error: 'Invalid judge.' })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return reply(500, { error: 'Account deletion is unavailable.' })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: caller, error: authError } = await admin.auth.getUser(token)
  if (authError || !caller.user) return reply(401, { error: 'Your session has expired. Sign in again.' })

  const { data: adminProfile, error: adminError } = await admin.from('profiles')
    .select('role').eq('id', caller.user.id).single()
  if (adminError || adminProfile?.role !== 'admin') return reply(403, { error: 'Only the admin can delete judges.' })

  const { data: target, error: targetError } = await admin.from('profiles')
    .select('role').eq('id', judgeId).single()
  if (targetError || target?.role !== 'judge') return reply(404, { error: 'Judge not found.' })

  const { error: deleteError } = await admin.auth.admin.deleteUser(judgeId)
  if (deleteError) return reply(500, { error: 'Unable to delete this judge. Please try again.' })

  return reply(200, { ok: true })
})
