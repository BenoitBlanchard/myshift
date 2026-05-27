'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { WorkSession, Mission, Pause, ProductionSnapshot } from '@/types'
import { formatDate } from '@/lib/utils'
import { formatLph, calcStats } from '@/lib/productivity'

interface SessionWithData extends WorkSession {
  missions: Mission[]
  pauses: Pause[]
  snapshots: ProductionSnapshot[]
  lph: number | null
  totalLines: number | null
  totalWeight: number
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [targetLph, setTargetLph] = useState(80)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoading(true)
    try {
      const [sessionsRes, profileRes] = await Promise.all([
        fetch('/api/sessions/history'),
        fetch('/api/profile'),
      ])
      const sessionsData: WorkSession[] = await sessionsRes.json()
      const profile = await profileRes.json()
      if (profile?.target_lph) setTargetLph(profile.target_lph)

      if (!sessionsData?.length) {
        setSessions([])
        return
      }

      const enriched: SessionWithData[] = await Promise.all(
        sessionsData.map(async s => {
          const [m, p, sn] = await Promise.all([
            fetch(`/api/missions?session_id=${s.id}`).then(r => r.json()).catch(() => []),
            fetch(`/api/pauses?session_id=${s.id}`).then(r => r.json()).catch(() => []),
            fetch(`/api/snapshots?session_id=${s.id}`).then(r => r.json()).catch(() => []),
          ])
          const missions: Mission[] = m ?? []
          const pauses: Pause[] = p ?? []
          const snapshots: ProductionSnapshot[] = sn ?? []

          const stats = calcStats(s, missions, pauses, snapshots, targetLph)
          return {
            ...s,
            missions,
            pauses,
            snapshots,
            lph: stats.theoretical,
            totalLines: stats.totalFinalLines,
            totalWeight: missions.reduce((a, x) => a + x.total_weight_kg, 0),
          }
        })
      )
      setSessions(enriched.sort((a, b) => b.date.localeCompare(a.date)))
    } finally {
      setLoading(false)
    }
  }

  const withData = sessions.filter(s => s.lph !== null)
  const avgLph = withData.length
    ? withData.reduce((a, s) => a + (s.lph ?? 0), 0) / withData.length
    : null
  const rolesCount = sessions.flatMap(s => s.missions).filter(m => m.support_type === 'role').length
  const palettesCount = sessions.flatMap(s => s.missions).filter(m => m.support_type === 'palette').length
  const avgLphRoles = calcAvgLph(sessions, 'role')
  const avgLphPalettes = calcAvgLph(sessions, 'palette')

  return (
    <>
      <TopBar title="Historique" />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
            Aucune session enregistrée
          </div>
        ) : (
          <>
            {/* Résumé global */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-white tabular-nums">{sessions.length}</p>
                <p className="text-xs text-zinc-500">journées</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold tabular-nums ${avgLph && avgLph >= targetLph ? 'text-emerald-400' : avgLph ? 'text-amber-400' : 'text-zinc-400'}`}>
                  {formatLph(avgLph)}
                </p>
                <p className="text-xs text-zinc-500">moy. l/h</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white tabular-nums">
                  {sessions.reduce((a, s) => a + (s.totalLines ?? 0), 0)}
                </p>
                <p className="text-xs text-zinc-500">lignes total</p>
              </div>
            </div>

            {/* Comparatif rôles vs palettes */}
            {(rolesCount > 0 || palettesCount > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Rôles vs Palettes</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-300 tabular-nums">{rolesCount}</p>
                    <p className="text-xs text-blue-400">missions rôles</p>
                    {avgLphRoles !== null && (
                      <p className="text-sm font-semibold text-white mt-1 tabular-nums">{formatLph(avgLphRoles)} l/h moy.</p>
                    )}
                  </div>
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-300 tabular-nums">{palettesCount}</p>
                    <p className="text-xs text-amber-400">missions palettes</p>
                    {avgLphPalettes !== null && (
                      <p className="text-sm font-semibold text-white mt-1 tabular-nums">{formatLph(avgLphPalettes)} l/h moy.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Liste sessions */}
            <div className="flex flex-col gap-2">
              {sessions.map(s => (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-xl p-4 flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="font-semibold text-white capitalize text-sm">{formatDate(s.date)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {s.missions.length} missions · {s.totalLines ?? '?'} lignes · {Math.round(s.totalWeight)}kg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold tabular-nums ${
                      s.lph === null ? 'text-zinc-500' :
                      s.lph >= targetLph ? 'text-emerald-400' :
                      s.lph >= targetLph * 0.95 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {formatLph(s.lph)}
                    </p>
                    <p className="text-[10px] text-zinc-600">l/h théo</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  )
}

function calcAvgLph(sessions: SessionWithData[], type: 'role' | 'palette'): number | null {
  const filtered = sessions.filter(s => s.missions.some(m => m.support_type === type))
  if (!filtered.length) return null
  const withLph = filtered.filter(s => s.lph !== null)
  if (!withLph.length) return null
  return withLph.reduce((a, s) => a + (s.lph ?? 0), 0) / withLph.length
}
