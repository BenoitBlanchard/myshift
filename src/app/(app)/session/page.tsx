'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogIn, LogOut, Play, Square, Coffee, ChevronRight,
  Zap, AlarmClock, Truck, MessageSquare, Calculator
} from 'lucide-react'
import { useSessionStore } from '@/store/session'
import { useWakeLock } from '@/hooks/useWakeLock'
import { TopBar } from '@/components/layout/TopBar'
import { BigButton } from '@/components/ui/BigButton'
import { Modal } from '@/components/ui/Modal'
import { MissionForm } from '@/components/session/MissionForm'
import { ProductionInput } from '@/components/session/ProductionInput'
import { MissionCalculator } from '@/components/session/MissionCalculator'
import { AdjustTotalModal } from '@/components/session/AdjustTotalModal'
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
  const [noteModal, setNoteModal] = useState<{ missionId: string; text: string } | null>(null)
  const [calcModal, setCalcModal] = useState<{ missionId: string; currentNote: string | null } | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'endMission' | 'padDisconnect' | null>(null)
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

    const snapRes = await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        mission_id: activeMission.id,
        total_final_lines: totalLines,
        ...(remainingLines !== null ? { remaining_command_lines: remainingLines } : {}),
      }),
    })
    const snapshot = await snapRes.json()
    store.addSnapshot(snapshot)

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

  async function handleSaveNote() {
    if (!noteModal) return
    setLoading(true)
    const res = await fetch('/api/missions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteModal.missionId, notes: noteModal.text || null }),
    })
    const updated = await res.json()
    store.updateMission(noteModal.missionId, updated)
    setNoteModal(null)
    setLoading(false)
  }

  async function handleSaveAdjust(newTotal: number) {
    if (!session) return
    const currentAdjustment = session.lines_adjustment ?? 0
    const currentTotal = stats?.totalFinalLines ?? lastSnap?.total_final_lines ?? 0
    const baseTotal = (currentTotal as number) - currentAdjustment
    const newAdjustment = newTotal - baseTotal
    setLoading(true)
    const res = await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.id, lines_adjustment: newAdjustment === 0 ? null : newAdjustment }),
    })
    const updated = await res.json()
    store.updateSession(updated)
    setShowAdjustModal(false)
    setLoading(false)
  }

  async function handleSaveCalc(newNote: string) {
    if (!calcModal) return
    setLoading(true)
    const res = await fetch('/api/missions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: calcModal.missionId, notes: newNote }),
    })
    const updated = await res.json()
    store.updateMission(calcModal.missionId, updated)
    setCalcModal(null)
    setLoading(false)
  }

  // ── Dériver l'état courant ────────────────────────────────
  const hasPad = !!session?.pad_connected_at
  const padDone = !!session?.pad_disconnected_at

  // Empêche la mise en veille pendant la session active (pad connecté, pas encore déconnecté)
  useWakeLock(hasPad && !padDone)
  const isInMission = !!activeMission
  const isPaused = !!activePause
  const lastSnap = snapshots.length
    ? snapshots.reduce((a, b) => new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b)
    : null

  // Vrai restant sur la mission active : basé sur le dernier snapshot pris pendant cette mission
  const activeMissionSnap = activeMission
    ? snapshots
        .filter(s =>
          s.mission_id === activeMission.id &&
          activeMission.started_at &&
          new Date(s.recorded_at) >= new Date(activeMission.started_at)
        )
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0] ?? null
    : null

  let realRemainingLines: number | null = null
  if (activeMission) {
    if (activeMissionSnap?.remaining_command_lines != null) {
      realRemainingLines = activeMissionSnap.remaining_command_lines
    } else if (activeMissionSnap) {
      const snapshotTime = new Date(activeMissionSnap.recorded_at)
      const linesBeforeSnap = missions
        .filter(m => m.id !== activeMission.id && m.ended_at && new Date(m.ended_at) <= snapshotTime)
        .reduce((acc, m) => acc + m.total_pad_lines, 0)
      const linesDone = Math.max(0, activeMissionSnap.total_final_lines - linesBeforeSnap)
      realRemainingLines = Math.max(0, activeMission.total_pad_lines - linesDone)
    } else {
      realRemainingLines = activeMission.total_pad_lines
    }
  }

  return (
    <>
      <TopBar title="Session" />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* En pause — bannière prominente */}
        {isPaused && (
          <div className="bg-gradient-to-r from-amber-950/60 to-zinc-900/0 border border-amber-800/40 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_30px_rgba(245,158,11,0.06)]">
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
          <div className="bg-gradient-to-br from-blue-950/60 via-blue-950/20 to-zinc-900/0 border border-blue-800/40 rounded-2xl p-4 shadow-[0_0_40px_rgba(59,130,246,0.08)]">
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
              {realRemainingLines !== null && (
                <div className="text-right ml-3">
                  <p className="text-[10px] text-blue-300/40 uppercase tracking-wider">Restant</p>
                  <p className="text-2xl font-bold text-blue-200 tabular-nums">{realRemainingLines}</p>
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
                onClick={() => setConfirmAction('endMission')}
                loading={loading}
              />
            </div>
            <div className="flex items-stretch gap-2 mt-2">
              <button
                type="button"
                onClick={() => setNoteModal({ missionId: activeMission.id, text: activeMission.notes ?? '' })}
                className="flex-1 flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-zinc-900/60 border border-white/[0.06] hover:border-white/[0.12] text-zinc-500 hover:text-zinc-300 text-sm transition-all min-w-0"
              >
                <MessageSquare size={16} className="shrink-0" />
                {activeMission.notes
                  ? <span className="truncate text-zinc-400">{activeMission.notes}</span>
                  : <span>Ajouter une note…</span>
                }
              </button>
              <button
                type="button"
                onClick={() => setCalcModal({ missionId: activeMission.id, currentNote: activeMission.notes ?? null })}
                className="px-4 py-3.5 rounded-2xl bg-zinc-900/60 border border-white/[0.06] hover:border-white/[0.12] text-zinc-500 hover:text-zinc-300 transition-all shrink-0"
                title="Calculette"
              >
                <Calculator size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Stats temps réel */}
        {hasPad && !padDone && (
          <StatsGrid stats={stats} isLive />
        )}

        {/* Timeline */}
        <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4 flex flex-col gap-3">
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
            <BigButton
              label="Déco pad"
              icon={LogOut}
              variant="danger"
              onClick={() => setConfirmAction('padDisconnect')}
              loading={loading}
              className="w-full"
            />
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
          <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4">
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">
              Missions ({missions.length})
            </p>
            <div className="flex flex-col gap-3">
              {missions.map(m => {
                // Cherche un snapshot pris PENDANT cette mission avec remaining_command_lines
                const mSnap = snapshots
                  .filter(s =>
                    s.mission_id === m.id &&
                    s.remaining_command_lines != null &&
                    m.started_at && m.ended_at &&
                    new Date(s.recorded_at) >= new Date(m.started_at) &&
                    new Date(s.recorded_at) <= new Date(m.ended_at)
                  )
                  .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]

                let reguleDiff: number | null = null
                if (mSnap && mSnap.remaining_command_lines != null) {
                  const snapshotTime = new Date(mSnap.recorded_at)
                  const linesBeforeSnap = missions
                    .filter(m2 => m2.id !== m.id && m2.ended_at && new Date(m2.ended_at) <= snapshotTime)
                    .reduce((acc, m2) => acc + m2.total_pad_lines, 0)
                  const alreadyCounted = Math.max(0, mSnap.total_final_lines - linesBeforeSnap)
                  const effectiveTotal = alreadyCounted + mSnap.remaining_command_lines
                  reguleDiff = effectiveTotal - m.total_pad_lines
                }

                return (
                  <div key={m.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
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
                    {reguleDiff !== null && (
                      <p className={`text-xs pl-1 font-semibold ${reguleDiff < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        régule {reguleDiff > 0 ? '+' : ''}{reguleDiff} lig.
                      </p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-zinc-500 pl-1 leading-relaxed">{m.notes}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setNoteModal({ missionId: m.id, text: m.notes ?? '' })}
                        className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
                      >
                        <MessageSquare size={11} />
                        {m.notes ? 'Modifier la note' : 'Ajouter une note'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalcModal({ missionId: m.id, currentNote: m.notes ?? null })}
                        className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
                        title="Calculette"
                      >
                        <Calculator size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {session?.lines_adjustment != null && session.lines_adjustment !== 0 && (
              <p className={`text-xs font-semibold pl-1 mt-2 ${session.lines_adjustment < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                régule {session.lines_adjustment > 0 ? '+' : ''}{session.lines_adjustment} lig.
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-sm">
              <span className="text-zinc-500">Total pad</span>
              <span className="text-white font-semibold tabular-nums">
                {missions.reduce((a, m) => a + m.total_pad_lines, 0)} lignes ·{' '}
                {Math.round(missions.reduce((a, m) => a + m.total_weight_kg, 0))}kg
              </span>
            </div>
            {(stats?.totalFinalLines != null || lastSnap) && (
              <button
                type="button"
                onClick={() => setShowAdjustModal(true)}
                className="mt-1 w-full flex justify-between items-center text-sm hover:bg-zinc-800/40 rounded-xl px-1 py-0.5 -mx-1 transition-colors group"
              >
                <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Lignes finales (pad)</span>
                <span className="text-blue-400 font-semibold tabular-nums underline decoration-dotted underline-offset-2">
                  {stats?.totalFinalLines ?? lastSnap?.total_final_lines}
                </span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showMissionForm && (
        <Modal title="Nouvelle mission" onClose={() => setShowMissionForm(false)}>
          <MissionForm
            missionNumber={(missions.length) + 1}
            deadTimeMs={stats?.currentDeadTimeMs}
            onSubmit={handleStartMission}
            onCancel={() => setShowMissionForm(false)}
            loading={loading}
          />
        </Modal>
      )}

      {showProductionInput && (
        <Modal title="Injection Production" onClose={() => setShowProductionInput(false)}>
          <ProductionInput
            currentLines={stats?.totalFinalLines ?? lastSnap?.total_final_lines ?? null}
            maxLines={missions.reduce((a, m) => a + m.total_pad_lines, 0)}
            stats={stats}
            onSubmit={handleProduction}
            onCancel={() => setShowProductionInput(false)}
            loading={loading}
          />
        </Modal>
      )}

      {confirmAction && (
        <Modal
          title={confirmAction === 'endMission' ? 'Terminer la mission ?' : 'Déconnecter le pad ?'}
          onClose={() => setConfirmAction(null)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-400">
              {confirmAction === 'endMission'
                ? 'La mission sera clôturée. Cette action est irréversible.'
                : 'Le pad sera déconnecté. Les calculs de productivité s\'arrêteront.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="py-4 rounded-2xl bg-zinc-800/60 text-zinc-300 font-semibold border border-white/[0.08] hover:bg-zinc-700/70 active:scale-[0.97] transition-all"
              >
                Non
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setConfirmAction(null)
                  if (confirmAction === 'endMission') handleEndMission()
                  else handlePadDisconnect()
                }}
                className="py-4 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 text-white font-semibold border border-red-400/20 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:from-red-400 hover:to-red-600 disabled:opacity-40 active:scale-[0.97] transition-all"
              >
                {loading ? '…' : 'Oui'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showAdjustModal && (() => {
        const currentTotal = stats?.totalFinalLines ?? lastSnap?.total_final_lines ?? 0
        return (
          <AdjustTotalModal
            currentTotal={currentTotal as number}
            currentAdjustment={session?.lines_adjustment ?? 0}
            onSave={handleSaveAdjust}
            onClose={() => setShowAdjustModal(false)}
            loading={loading}
          />
        )
      })()}

      {calcModal && (
        <MissionCalculator
          currentNote={calcModal.currentNote}
          onSave={handleSaveCalc}
          onClose={() => setCalcModal(null)}
        />
      )}

      {noteModal && (
        <Modal title="Note de mission" onClose={() => setNoteModal(null)}>
          <div className="flex flex-col gap-4">
            <textarea
              value={noteModal.text}
              onChange={e => setNoteModal(n => n ? { ...n, text: e.target.value } : n)}
              placeholder="Mon rôle C est tombé… j'ai trouvé des souris dans la palette 1/2J 3701…"
              rows={6}
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all resize-none placeholder:text-zinc-600"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="py-4 rounded-2xl bg-zinc-800/60 text-zinc-300 font-semibold border border-white/[0.08] hover:bg-zinc-700/70 active:scale-[0.97] transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={loading}
                className="py-4 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white font-semibold border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:from-blue-400 hover:to-blue-600 disabled:opacity-40 active:scale-[0.97] transition-all"
              >
                {loading ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
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
                    className="text-left bg-zinc-800/60 hover:bg-zinc-700/70 border border-white/[0.06] rounded-2xl px-4 py-3 flex justify-between items-center active:scale-[0.98] transition-all"
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
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
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
