import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'

let demoSnapshotSeq = 0

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json([], { status: 400 })

  const { data } = await supabase
    .from('production_snapshots')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('recorded_at')

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const body = await request.json()
    return NextResponse.json({
      id: `demo-snapshot-${++demoSnapshotSeq}`,
      user_id: 'demo-user-id',
      recorded_at: new Date().toISOString(),
      ...body,
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('production_snapshots')
    .insert({
      ...body,
      user_id: user.id,
      recorded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
