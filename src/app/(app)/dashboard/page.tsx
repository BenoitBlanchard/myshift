'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { useSessionStore } from '@/store/session'
import { TopBar } from '@/components/layout/TopBar'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { Profile } from '@/types'
import { formatDate, formatTimestamp, today } from '@/lib/utils'

export default function DashboardPage() {
  const store = useSessionStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(() => store.tick(), 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [sessionRes, profileRes] = await Promise.all([
        fetch(`/api/sessions?date=${today()}`),
        fetch('/api/profile'),
      ])
      const sessionData = await sessionRes.json()
      const profileData: Profile = await profileRes.json()

      if (!profileData?.id) return

      let missionsData = [], pausesData = [], snapshotsData = [], pauseSchedules = []

      if (sessionData?.id) {
        const [m, p, s, ps] = await Promise.all([
          fetch(`/api/missions?session_id=${sessionData.id}`).then(r => r.json()),
          fetch(`/api/pauses?session_id=${sessionData.id}`).then(r => r.json()),
          fetch(`/api/snapshots?session_id=${sessionData.id}`).then(r => r.json()),
          fetch('/api/pause-schedules').then(r => r.json()),
        ])
        missionsData = m ?? []
        pausesData = p ?? []
        snapshotsData = s ?? []
        pauseSchedules = ps ?? []
      } else {
        pauseSchedules = await fetch('/api/pause-schedules').then(r => r.json()).catch(() => [])
      }

      store.setData({
        session: sessionData ?? null,
        missions: missionsData,
        pauses: pausesData,
        snapshots: snapshotsData,
        pauseSchedules: pauseSchedules ?? [],
        profile: profileData,
      })
    } finally {
      setLoading(false)
    }
  }

  const { session, stats, profile, missions, snapshots } = store
  const hasSession = !!session?.pad_connected_at
  const todayStr = formatDate(today())
  const lastSnap = snapshots.length
    ? snapshots.reduce((a, b) => new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b)
    : null

  return (
    <>
      <TopBar
        title="MyShift"
        right={
          profile && (
            <span className="text-sm text-zinc-400 font-medium">{profile.pseudo}</span>
          )
        }
      />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <p className="text-zinc-400 text-sm font-medium capitalize">{todayStr}</p>
          {profile && (
            <span className="text-xs text-zinc-600">
              Objectif <span className="text-zinc-400 font-medium">{profile.target_lph} l/h</span>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : !session ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center gap-4 text-center">
            <p className="text-zinc-400 text-sm">Aucune session aujourd&apos;hui</p>
            <Link
              href="/session"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              <Play size={16} />
              Démarrer ma journée
            </Link>
          </div>
        ) : (
          <>
            {/* Statut session */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  {session.pad_disconnected_at
                    ? 'Journée terminée'
                    : session.pad_connected_at
                    ? 'Pad connecté'
                    : 'Arrivé(e)'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Connexion {formatTimestamp(session.pad_connected_at)} · {missions.length} mission{missions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Link
                href="/session"
                className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors"
              >
                Voir →
              </Link>
            </div>

            <StatsGrid stats={stats} isLive={hasSession && !session.pad_disconnected_at} />

            {lastSnap && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Dernière production</p>
                  <p className="text-2xl font-bold text-white tabular-nums mt-0.5">
                    {lastSnap.total_final_lines}{' '}
                    <span className="text-sm font-normal text-zinc-400">lignes finales</span>
                  </p>
                </div>
                <p className="text-xs text-zinc-600">{formatTimestamp(lastSnap.recorded_at)}</p>
              </div>
            )}

            {missions.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Missions aujourd&apos;hui</p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums">{missions.length}</p>
                    <p className="text-xs text-zinc-500">missions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {missions.reduce((a, m) => a + m.total_pad_lines, 0)}
                    </p>
                    <p className="text-xs text-zinc-500">lignes pad</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {Math.round(missions.reduce((a, m) => a + m.total_weight_kg, 0))}
                    </p>
                    <p className="text-xs text-zinc-500">kg</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
