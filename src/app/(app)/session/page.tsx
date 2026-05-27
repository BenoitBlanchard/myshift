'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogIn, LogOut, Play, Square, Coffee, ChevronRight,
  Zap, AlarmClock, Truck
} from 'lucide-react'
import { useSessionStore } from '@/store/session'
import { TopBar } from '@/components/layout/TopBar'
import { BigButton } from '@/components/ui/BigButton'
import { Modal } from '@/components/ui/Modal'
import { MissionForm } from '@/components/session/MissionForm'
import { ProductionInput } from '@/components/session/ProductionInput'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { MissionFormData, PauseSchedule } from '@/types'
import { elapsed, formatTimestamp, today } from '@/lib/utils'

export default function SessionPage() {
  const router = useRouter()
  const store = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [showMissionForm, setShowMissionForm] = useState(false)
  const [showProductionInput, setShowProductionInput] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [tick, setTick] = useState(0)

  const { session, missions, pauses, snapshots, profile, activeMission, activePause, stats } = store

  // Timer tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      useSessionStore.getState().tick()
      setTick(t => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Charger les données au montage
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [sessionRes, profileRes] = await Promise.all([
        fetch(`/api/sessions?date=${today()}`),
        fetch('/api/profile'),
      ])
      const sessionData = await sessionRes.json()
      const profileData = await profileRes.json()

      if (!profileData?.id) {
        router.push('/login')
        return
      }

      let missionsData: typeof missions = []
      let pausesData: typeof pauses = []
      let snapshotsData: typeof snapshots = []
      let pauseSchedules: PauseSchedule[] = []

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
        pauseSchedules = await fetch('/api/pause-schedules').then(r => r.json())
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

  // ── Actions ──────────────────────────────────────────────

  async function handleArrival() {
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arrived_at: now }),
    })
    const data = await res.json()
    store.setData({
      session: data,
      missions: store.missions,
      pauses: store.pauses,
      snapshots: store.snapshots,
      pauseSchedules: store.pauseSchedules,
      profile: store.profile!,
    })
    setLoading(false)
  }

  async function handlePadConnect() {
    if (!session) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.id, pad_connected_at: now }),
    })
    const data = await res.json()
    store.updateSession(data)
    setLoading(false)
  }

  async function handleStartMission(formData: MissionFormData) {
    if (!session) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        support_type: formData.support_type,
        support_count: formData.support_count,
        supports: formData.supports,
        started_at: now,
      }),
    })
    const mission = await res.json()
    store.addMission(mission)
    setShowMissionForm(false)
    setLoading(false)
  }

  async function handleEndMission() {
    if (!activeMission) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/missions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeMission.id, ended_at: now }),
    })
    const updated = await res.json()
    store.updateMission(activeMission.id, updated)
    setLoading(false)
  }

  async function handleProduction(totalLines: number, remainingLines: number | null) {
    if (!session || !activeMission) return
    setLoading(true)

    // Créer le snapshot
    const snapRes = await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        mission_id: activeMission.id,
        total_final_lines: totalLines,
      }),
    })
    const snapshot = await snapRes.json()
    store.addSnapshot(snapshot)

    // Si lignes restantes fournies : recalculer le total_pad_lines de la mission
    if (remainingLines !== null) {
      const prevSnapshotLines = lastSnap?.total_final_lines ?? 0
      const linesDoneSoFar = Math.max(0, totalLines - prevSnapshotLines)
      const newMissionTotal = linesDoneSoFar + remainingLines
      const missionRes = await fetch('/api/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeMission.id, total_pad_lines: newMissionTotal }),
      })
      const updatedMission = await missionRes.json()
      store.updateMission(activeMission.id, updatedMission)
    }

    setShowProductionInput(false)
    setLoading(false)
  }

  async function handleStartPause(isSystemDeducted: boolean) {
    if (!session) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/pauses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        started_at: now,
        is_system_deducted: isSystemDeducted,
      }),
    })
    const pause = await res.json()
    store.addPause(pause)
    setShowPauseModal(false)
    setLoading(false)
  }

  async function handleEndPause() {
    if (!activePause) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/pauses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activePause.id, ended_at: now }),
    })
    const updated = await res.json()
    store.updatePause(activePause.id, updated)
    setLoading(false)
  }

  async function handlePadDisconnect() {
    if (!session) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.id, pad_disconnected_at: now }),
    })
    const data = await res.json()
    store.updateSession(data)
    setLoading(false)
  }

  async function handleDeparture() {
    if (!session) return
    setLoading(true)
    const now = new Date().toISOString()
    const res = await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.id, left_at: now }),
    })
    const data = await res.json()
    store.updateSession(data)
    setLoading(false)
  }

  // ── Dériver l'état courant ────────────────────────────────
  const hasPad = !!session?.pad_connected_at
  const padDone = !!session?.pad_disconnected_at
  const isInMission = !!activeMission
  const isPaused = !!activePause
  const lastSnap = snapshots.length
    ? snapshots.reduce((a, b) => new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b)
    : null

  return (
    <>
      <TopBar title="Session" />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* En pause — bannière prominente */}
        {isPaused && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-amber-400 font-semibold text-base">En pause</p>
              <p className="text-amber-300/70 text-sm">
                Depuis {formatTimestamp(activePause.started_at)} · {elapsed(activePause.started_at)}
              </p>
              <p className="text-amber-300/40 text-xs mt-0.5">
                {activePause.is_system_deducted ? 'Décomptée Magellan' : 'Non décomptée'}
              </p>
            </div>
            <BigButton
              label="Fin pause"
              variant="warning"
              onClick={handleEndPause}
              loading={loading}
            />
          </div>
        )}

        {/* Mission active */}
        {isInMission && !isPaused && (
          <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <p className="text-blue-300 font-semibold text-base">
                  Mission #{activeMission.mission_number}
                </p>
                <p className="text-blue-300/60 text-sm">
                  {activeMission.support_type === 'role' ? 'Rôle' : 'Palette'} ×{activeMission.support_count}{' '}
                  · {activeMission.total_pad_lines} lignes pad
                </p>
                <p className="text-blue-300/40 text-xs font-mono mt-0.5">
                  {elapsed(activeMission.started_at)}
                </p>
              </div>
              {stats?.projectedRemainingLines != null && (
                <div className="text-right ml-3">
                  <p className="text-[10px] text-blue-300/40 uppercase tracking-wider">Restant</p>
                  <p className="text-2xl font-bold text-blue-200 tabular-nums">~{stats.projectedRemainingLines}</p>
                  <p className="text-[10px] text-blue-300/40">lignes</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <BigButton
                label="Production"
                icon={Zap}
                variant="primary"
                onClick={() => setShowProductionInput(true)}
                loading={loading}
              />
              <BigButton
                label="Fin mission"
                icon={Square}
                variant="danger"
                onClick={handleEndMission}
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* Stats temps réel */}
        {hasPad && !padDone && (
          <StatsGrid stats={stats} isLive />
        )}

        {/* Timeline */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex flex-col gap-3">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">Timeline</p>

          <div className="grid grid-cols-2 gap-2">
            <BigButton
              label="Arrivée"
              icon={AlarmClock}
              sublabel={session?.arrived_at ? formatTimestamp(session.arrived_at) : undefined}
              variant={session?.arrived_at ? 'ghost' : 'primary'}
              disabled={!!session?.arrived_at}
              onClick={handleArrival}
              loading={loading}
            />

            <BigButton
              label={session?.pad_connected_at ? 'Pad connecté' : 'Connexion pad'}
              icon={LogIn}
              sublabel={session?.pad_connected_at ? formatTimestamp(session.pad_connected_at) : undefined}
              variant={session?.pad_connected_at ? 'ghost' : 'success'}
              disabled={!session?.arrived_at || !!session?.pad_connected_at}
              onClick={handlePadConnect}
              loading={loading}
            />
          </div>

          {hasPad && !padDone && (
            <div className="grid grid-cols-2 gap-2">
              <BigButton
                label={isInMission ? 'Nouvelle mission' : 'Début mission'}
                icon={Play}
                variant={isInMission ? 'ghost' : 'success'}
                disabled={isPaused || isInMission}
                onClick={() => setShowMissionForm(true)}
                loading={loading}
              />

              <BigButton
                label="Pause"
                icon={Coffee}
                variant="warning"
                disabled={isPaused}
                onClick={() => setShowPauseModal(true)}
                loading={loading}
              />
            </div>
          )}

          {hasPad && !padDone && !isInMission && !isPaused && (
            <div className="grid grid-cols-2 gap-2">
              <BigButton
                label="Déco pad"
                icon={LogOut}
                variant="danger"
                onClick={handlePadDisconnect}
                loading={loading}
              />
              <BigButton
                label="Mission suivante"
                icon={ChevronRight}
                variant="success"
                onClick={() => setShowMissionForm(true)}
                loading={loading}
              />
            </div>
          )}

          {padDone && !session?.left_at && (
            <BigButton
              label="Fin de journée — Départ"
              icon={Truck}
              variant="danger"
              size="lg"
              onClick={handleDeparture}
              loading={loading}
              className="w-full"
            />
          )}
        </div>

        {/* Résumé missions */}
        {missions.length > 0 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">
              Missions ({missions.length})
            </p>
            <div className="flex flex-col gap-2">
              {missions.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">
                    #{m.mission_number} · {m.support_type === 'role' ? 'Rôle' : 'Palette'} ×{m.support_count}
                  </span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-white font-semibold">{m.total_pad_lines} lig.</span>
                    <span className="text-zinc-500">{m.total_weight_kg}kg</span>
                    {m.ended_at ? (
                      <span className="text-emerald-400 text-xs">✓</span>
                    ) : (
                      <span className="text-blue-400 text-xs animate-pulse">⏱</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-sm">
              <span className="text-zinc-500">Total pad</span>
              <span className="text-white font-semibold tabular-nums">
                {missions.reduce((a, m) => a + m.total_pad_lines, 0)} lignes ·{' '}
                {Math.round(missions.reduce((a, m) => a + m.total_weight_kg, 0))}kg
              </span>
            </div>
            {lastSnap && (
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-zinc-500">Lignes finales (pad)</span>
                <span className="text-blue-400 font-semibold tabular-nums">{lastSnap.total_final_lines}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showMissionForm && (
        <Modal title="Nouvelle mission" onClose={() => setShowMissionForm(false)}>
          <MissionForm
            missionNumber={(missions.length) + 1}
            onSubmit={handleStartMission}
            onCancel={() => setShowMissionForm(false)}
            loading={loading}
          />
        </Modal>
      )}

      {showProductionInput && (
        <Modal title="Injection Production" onClose={() => setShowProductionInput(false)}>
          <ProductionInput
            currentLines={lastSnap?.total_final_lines ?? null}
            maxLines={missions.reduce((a, m) => a + m.total_pad_lines, 0)}
            stats={stats}
            onSubmit={handleProduction}
            onCancel={() => setShowProductionInput(false)}
            loading={loading}
          />
        </Modal>
      )}

      {showPauseModal && (
        <Modal title="Démarrer une pause" onClose={() => setShowPauseModal(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400">
              Cette pause est-elle décomptée par Magellan ?
            </p>
            {store.pauseSchedules?.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Pauses planifiées</p>
                {store.pauseSchedules.map(ps => (
                  <button
                    key={ps.id}
                    onClick={() => handleStartPause(ps.is_system_deducted)}
                    className="text-left bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 flex justify-between items-center"
                  >
                    <span className="text-white font-medium">{ps.name}</span>
                    <span className="text-gray-400 text-sm">
                      {ps.duration_minutes}min ·{' '}
                      {ps.is_system_deducted ? (
                        <span className="text-amber-400">décomptée</span>
                      ) : (
                        <span className="text-gray-500">non décomptée</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
              <BigButton
                label="Pause non décomptée"
                sublabel="14h / 18h"
                variant="ghost"
                onClick={() => handleStartPause(false)}
              />
              <BigButton
                label="Pause décomptée"
                sublabel="16h Magellan"
                variant="warning"
                onClick={() => handleStartPause(true)}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
