import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildExcel } from '@/lib/excel'
import { isSupabaseConfigured } from '@/lib/demo'

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Export non disponible en mode démo' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  if (!sessions?.length) {
    return NextResponse.json({ error: 'Aucune donnée pour cette période' }, { status: 404 })
  }

  // Enrichir avec les missions, pauses, snapshots
  const enriched = await Promise.all(
    sessions.map(async s => {
      const [missionsRes, pausesRes, snapshotsRes] = await Promise.all([
        supabase.from('missions').select('*').eq('session_id', s.id).order('mission_number'),
        supabase.from('pauses').select('*').eq('session_id', s.id).order('started_at'),
        supabase.from('production_snapshots').select('*').eq('session_id', s.id).order('recorded_at'),
      ])
      return {
        ...s,
        pseudo: user.user_metadata?.pseudo ?? 'user',
        missions: missionsRes.data ?? [],
        pauses: pausesRes.data ?? [],
        snapshots: snapshotsRes.data ?? [],
      }
    })
  )

  const xlsx = buildExcel({ sessions: enriched, month, year })

  return new NextResponse(Buffer.from(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="myshift-${year}-${String(month).padStart(2, '0')}.xlsx"`,
    },
  })
}
