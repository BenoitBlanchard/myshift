import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { formatDate, formatTimestamp } from '@/lib/utils'
import { calcStats, formatDuration, formatLph } from '@/lib/productivity'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [sessionRes, profileRes] = await Promise.all([
    supabase.from('work_sessions').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  if (!sessionRes.data) notFound()
  const session = sessionRes.data
  const profile = profileRes.data

  const [missionsRes, pausesRes, snapshotsRes] = await Promise.all([
    supabase.from('missions').select('*, mission_supports(*)').eq('session_id', id).order('mission_number'),
    supabase.from('pauses').select('*').eq('session_id', id).order('started_at'),
    supabase.from('production_snapshots').select('*').eq('session_id', id).order('recorded_at'),
  ])

  const missions = missionsRes.data ?? []
  const pauses = pausesRes.data ?? []
  const snapshots = snapshotsRes.data ?? []
  const targetLph = profile?.target_lph ?? 80

  const endTime = session.pad_disconnected_at ?? session.left_at ?? new Date().toISOString()
  const stats = calcStats(session, missions, pauses, snapshots, targetLph, new Date(endTime))

  const workDurationMs = session.arrived_at && session.left_at
    ? new Date(session.left_at).getTime() - new Date(session.arrived_at).getTime()
    : null
  const prodDurationMs = session.pad_connected_at && session.pad_disconnected_at
    ? new Date(session.pad_disconnected_at).getTime() - new Date(session.pad_connected_at).getTime()
    : null

  return (
    <>
      <TopBar title={formatDate(session.date)} />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pad', value: formatLph(stats.pad), unit: 'l/h' },
            { label: 'Théorique', value: formatLph(stats.theoretical), unit: 'l/h' },
            { label: 'Réel', value: formatLph(stats.real), unit: 'l/h' },
          ].map(({ label, value, unit }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-600">{unit}</p>
            </div>
          ))}
        </div>

        {/* Journée */}
        {(workDurationMs !== null || prodDurationMs !== null) && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Journée</p>
            <div className="flex flex-col gap-2 text-sm">
              {workDurationMs !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Temps total travaillé</span>
                  <span className="text-white font-semibold tabular-nums">{formatDuration(workDurationMs)}</span>
                </div>
              )}
              {prodDurationMs !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Temps de production (pad)</span>
                  <span className="text-white font-semibold tabular-nums">{formatDuration(prodDurationMs)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Timeline</p>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: 'Arrivée', time: session.arrived_at },
              { label: 'Connexion pad', time: session.pad_connected_at },
              { label: 'Déco pad', time: session.pad_disconnected_at },
              { label: 'Départ', time: session.left_at },
            ].map(({ label, time }) => time && (
              <div key={label} className="flex justify-between">
                <span className="text-gray-400">{label}</span>
                <span className="text-white font-mono">{formatTimestamp(time)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missions */}
        {missions.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Missions ({missions.length})
            </p>
            <div className="flex flex-col gap-3">
              {missions.map(m => (
                <div key={m.id} className="border-b border-gray-800 last:border-0 pb-3 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">
                      Mission #{m.mission_number} — {m.support_type === 'role' ? 'Rôle' : 'Palette'} ×{m.support_count}
                    </span>
                    <span className="text-gray-400 text-sm">{m.total_pad_lines} lig.</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span>{formatTimestamp(m.started_at)} → {formatTimestamp(m.ended_at)}</span>
                    <span>{m.total_weight_kg}kg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pauses */}
        {pauses.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Pauses ({pauses.length})
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {pauses.map(p => (
                <div key={p.id} className="flex justify-between items-center">
                  <span className="text-gray-400">
                    {formatTimestamp(p.started_at)} → {formatTimestamp(p.ended_at)}
                  </span>
                  <span className={p.is_system_deducted ? 'text-amber-400' : 'text-gray-600'}>
                    {p.is_system_deducted ? 'décomptée' : 'non décomptée'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Injections production */}
        {snapshots.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Injections production ({snapshots.length})
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {snapshots.map(s => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-gray-400">{formatTimestamp(s.recorded_at)}</span>
                  <span className="text-white font-bold">{s.total_final_lines} lignes finales</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
