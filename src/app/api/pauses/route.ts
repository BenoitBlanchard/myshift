import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'

let demoPauseSeq = 0

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json([], { status: 400 })

  const { data } = await supabase
    .from('pauses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('started_at')

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const body = await request.json()
    return NextResponse.json({ id: `demo-pause-${++demoPauseSeq}`, user_id: 'demo-user-id', ended_at: null, ...body })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('pauses')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const { id, ...updates } = await request.json()
    return NextResponse.json({ id, user_id: 'demo-user-id', ...updates })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json()
  const { data, error } = await supabase
    .from('pauses')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
