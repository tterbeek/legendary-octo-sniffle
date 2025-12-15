// api/member-count.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.writeHead(200, corsHeaders).end('OK')
  if (req.method !== 'GET') return res.writeHead(405, corsHeaders).end('Method Not Allowed')

  const listId = req.query.listId || req.body?.listId
  if (!listId) {
    return res
      .writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: false, error: 'Missing listId' }))
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('list_members')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', listId)

    if (error) throw error

    // list_members excludes owner; include them in the returned total
    const total = (count ?? 0) + 1

    return res
      .writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: true, count: total }))
  } catch (error) {
    console.error('member-count error:', error)
    return res
      .writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: false, error: error.message }))
  }
}
