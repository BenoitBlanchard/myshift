import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'

let demoMissionSeq = 0

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json([], { status: 400 })

  const { data } = await supabase
    .from('missions')
    .select('*, mission_supports(*)')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('mission_number')

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const body = await request.json()
    const id = `demo-mission-${++demoMissionSeq}`
    return NextResponse.json({
      id,
      session_id: body.session_id,
      user_id: 'demo-user-id',
      mission_number: demoMissionSeq,
      support_type: body.support_type ?? 'palette',
      support_count: body.support_count ?? 1,
      started_at: body.started_at ?? new Date().toISOString(),
      ended_at: null,
      total_pad_lines: body.supports?.reduce((a: number, s: { pad_lines: number }) => a + (s.pad_lines || 0), 0) ?? 0,
      total_weight_kg: body.supports?.reduce((a: number, s: { weight_kg: number }) => a + (s.weight_kg || 0), 0) ?? 0,
      total_liters: null,
      mission_supports: body.supports ?? [],
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { session_id, support_type, support_count, supports, started_at } = await request.json()

  const totalPadLines = supports.reduce((a: number, s: { pad_lines: number }) => a + (s.pad_lines || 0), 0)
  const totalWeight = supports.reduce((a: number, s: { weight_kg: number }) => a + (s.weight_kg || 0), 0)
  const totalLiters = supports.reduce((a: number, s: { liters?: number }) => a + (s.liters ?? 0), 0) || null

  const { count } = await supabase
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session_id)

  const { data: mission, error } = await supabase
    .from('missions')
    .insert({
      session_id,
      user_id: user.id,
      mission_number: (count ?? 0) + 1,
      support_type,
      support_count,
      started_at,
      total_pad_lines: totalPadLines,
      total_weight_kg: totalWeight,
      total_liters: totalLiters,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (supports?.length) {
    await supabase.from('mission_supports').insert(
      supports.map((s: { label: string; pad_lines: number; weight_kg: number; liters?: number }, i: number) => ({
        mission_id: mission.id,
        support_index: i + 1,
        label: s.label,
        pad_lines: s.pad_lines || 0,
        weight_kg: s.weight_kg || 0,
        liters: s.liters ?? null,
      }))
    )
  }

  return NextResponse.json(mission)
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
    .from('missions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
