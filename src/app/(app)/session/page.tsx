'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogIn, LogOut, Play, Square, Coffee, ChevronRight,
  AlarmClock, Truck, MessageSquare, Calculator
} from 'lucide-react'
import { useSessionStore } from '@/store/session'
import { useWakeLock } from '@/hooks/useWakeLock'
import { TopBar } from '@/components/layout/TopBar'
import { BigButton } from '@/components/ui/BigButton'
import { Modal } from '@/components/ui/Modal'
import { MissionForm } from '@/components/session/MissionForm'

import { MissionCalculator } from '@/components/session/MissionCalculator'

import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { MissionFormData, PauseSchedule } from '@/types'
import { elapsed, formatTimestamp, today } from '@/lib/utils'
import { formatDeadTime, formatDuration, formatLph } from '@/lib/productivity'

function InlineProductionStepper({
  min,
  max,
  onSubmit,
  loading,
}: {
  min: number
  max: number
  onSubmit: (v: number) => void
  loading?: boolean
}) {
  const [value, setValue] = useState(min)
  const [editing, setEditing] = useState(false)
  const [editStr, setEditStr] = useState(String(min))
  const prevMin = useRef(min)
  if (prevMin.current !== min) { prevMin.current = min; setValue(min) }

  const delta = value - min

  function clamp(n: number) { return Math.max(min, Math.min(max, n)) }

  function commitEdit() {
    const n = parseInt(editStr)
    if (!isNaN(n)) setValue(clamp(n))
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Stepper row */}
      <div className="bg-black/20 rounded-2xl p-1.5 flex items-center gap-1.5 border border-white/[0.04]">
        <button
          type="button"
          onClick={() => setValue(v => clamp(v - 1))}
          disabled={value <= min}
          className="h-14 w-12 rounded-xl bg-zinc-800/70 text-xl font-bold text-zinc-500 disabled:opacity-20 active:scale-[0.92] transition-all flex items-center justify-center shrink-0 border border-white/[0.05]"
        >
          −
        </button>

        {editing ? (
          <input
            type="number"
            inputMode="numeric"
            value={editStr}
            onChange={e => setEditStr(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            autoFocus
            className="flex-1 h-14 bg-zinc-800/60 border-2 border-blue-500/40 rounded-xl px-3 text-white text-center text-4xl font-bold focus:outline-none transition-all tabular-nums"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setEditStr(String(value)); setEditing(true) }}
            className="flex-1 h-14 rounded-xl text-white text-center text-4xl font-bold tabular-nums active:scale-[0.97] transition-all"
          >
            {value}
          </button>
        )}

        <button
          type="button"
          onClick={() => setValue(v => clamp(v + 1))}
          disabled={value >= max}
          className="h-14 w-[72px] rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 text-white text-3xl font-bold border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.55),0_1px_0_rgba(255,255,255,0.12)_inset] disabled:opacity-30 active:scale-[0.92] transition-all flex items-center justify-center shrink-0"
        >
          +
        </button>
      </div>

      {/* Valider */}
      {delta > 0 && (
        <button
          type="button"
          onClick={() => onSubmit(value)}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-white font-semibold border border-emerald-400/20 shadow-[0_0_16px_rgba(16,185,129,0.35)] hover:from-emerald-400 hover:to-emerald-600 disabled:opacity-40 active:scale-[0.97] transition-all text-sm tracking-wide"
        >
          {loading ? '…' : `✓  ${value} lignes — valider`}
        </button>
      )}
    </div>
  )
}

export default function SessionPage() {
  const router = useRouter()
  const store = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [showMissionForm, setShowMissionForm] = useState(false)

  const [showPauseModal, setShowPauseModal] = useState(false)
  const [noteModal, setNoteModal] = useState<{ missionId: string; text: string } | null>(null)
  const [calcModal, setCalcModal] = useState<{ missionId: string; currentNote: string | null } | null>(null)

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
          <div className="bg-gradient-to-br from-blue-950/70 via-blue-950/30 to-zinc-900/10 border border-blue-800/35 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.1)] overflow-hidden">

            {/* En-tête mission */}
            <div className="flex items-start justify-between px-4 pt-4 pb-3">
              <div className="flex-1 min-w-0">
                <p className="text-blue-200 font-bold text-lg leading-tight">
                  Mission #{activeMission.mission_number}
                </p>
                <p className="text-blue-300/55 text-sm mt-0.5">
                  {activeMission.support_type === 'role' ? 'Roll' : 'Palette'} ×{activeMission.support_count}
                  {' · '}{activeMission.total_pad_lines} lignes pad
                </p>
                {activeMission.supports?.some(s => s.quai) && (
                  <p className="text-blue-300/40 text-xs mt-1">
                    {activeMission.supports!.filter(s => s.quai).map(s => `${s.label} : ${s.quai}`).join(' · ')}
                  </p>
                )}
                <p className="text-blue-300/30 text-xs font-mono mt-1">{elapsed(activeMission.started_at)}</p>
              </div>
              {realRemainingLines !== null && (
                <div className="text-right ml-4 shrink-0">
                  <p className="text-[9px] text-blue-300/35 uppercase tracking-widest font-semibold">Restant</p>
                  <p className="text-3xl font-bold text-blue-200/90 tabular-nums leading-tight">{realRemainingLines}</p>
                  <p className="text-[9px] text-blue-300/35">lignes</p>
                </div>
              )}
            </div>

            {/* Zone production */}
            <div className="px-4 pb-3 flex flex-col gap-2">
              <p className="text-[9px] text-blue-300/25 uppercase tracking-widest font-semibold text-center">Lignes finales</p>
              <InlineProductionStepper
                min={stats?.totalFinalLines ?? lastSnap?.total_final_lines ?? 0}
                max={missions.reduce((a, m) => a + m.total_pad_lines, 0)}
                onSubmit={v => handleProduction(v, null)}
                loading={loading}
              />
            </div>

            {/* Séparateur */}
            <div className="mx-4 h-px bg-blue-900/40" />

            {/* Fin mission + utilitaires */}
            <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
              <BigButton
                label="Fin mission"
                icon={Square}
                variant="danger"
                onClick={() => setConfirmAction('endMission')}
                loading={loading}
                className="w-full"
              />
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModal({ missionId: activeMission.id, text: activeMission.notes ?? '' })}
                  className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-zinc-900/50 border border-white/[0.05] hover:border-white/[0.10] text-zinc-500 hover:text-zinc-300 text-sm transition-all min-w-0"
                >
                  <MessageSquare size={15} className="shrink-0" />
                  {activeMission.notes
                    ? <span className="truncate text-zinc-400 text-xs">{activeMission.notes}</span>
                    : <span className="text-xs">Ajouter une note…</span>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setCalcModal({ missionId: activeMission.id, currentNote: activeMission.notes ?? null })}
                  className="px-4 py-3 rounded-2xl bg-zinc-900/50 border border-white/[0.05] hover:border-white/[0.10] text-zinc-500 hover:text-zinc-300 transition-all shrink-0"
                >
                  <Calculator size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats temps réel */}
        {hasPad && !padDone && (
          <StatsGrid stats={stats} isLive />
        )}

        {/* Quais dernière mission — entre missions et après déco pad */}
        {(() => {
          const lastMission = missions
            .filter(m => m.ended_at)
            .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())[0]
          const supportsWithQuai = lastMission?.supports?.filter(s => s.quai != null && s.quai !== '') ?? []
          if (!lastMission || supportsWithQuai.length === 0) return null
          if (isInMission) return null
          if (session?.left_at) return null
          return (
            <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] px-4 py-3 flex flex-col gap-2">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">
                Mission #{lastMission.mission_number} — quais
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {supportsWithQuai.map(s => (
                  <div key={s.support_index} className="flex items-baseline gap-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.label}</span>
                    <span className="text-white font-bold text-lg tabular-nums leading-none">{s.quai}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Timeline — masquée en fin de journée (remplacée par le récap complet) */}
        {!session?.left_at && <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4 flex flex-col gap-3">
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
        </div>}


        {/* Récap complet fin de journée */}
        {session?.left_at && (
          <>
            {/* Timeline style BigButton */}
            <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4 flex flex-col gap-2">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">Timeline</p>
              <div className="grid grid-cols-2 gap-2">
                <BigButton label="Arrivée" icon={AlarmClock} sublabel={formatTimestamp(session.arrived_at)} variant="ghost" disabled onClick={() => {}} />
                <BigButton label="Pad connecté" icon={LogIn} sublabel={formatTimestamp(session.pad_connected_at)} variant="ghost" disabled onClick={() => {}} />
                <BigButton label="Déco pad" icon={LogOut} sublabel={formatTimestamp(session.pad_disconnected_at)} variant="ghost" disabled onClick={() => {}} />
                <BigButton label="Départ" icon={Truck} sublabel={formatTimestamp(session.left_at)} variant="ghost" disabled onClick={() => {}} />
              </div>
            </div>

            {/* Productivité */}
            {stats && (stats.pad !== null || stats.theoretical !== null) && (
              <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">Productivité</p>
                <div className="grid grid-cols-2 gap-3">
                  {stats.pad !== null && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">PAD</p>
                      <p className="text-2xl font-bold text-white tabular-nums">{formatLph(stats.pad)}<span className="text-sm font-normal text-zinc-500"> l/h</span></p>
                    </div>
                  )}
                  {stats.theoretical !== null && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Réel</p>
                      <p className="text-2xl font-bold text-white tabular-nums">{formatLph(stats.theoretical)}<span className="text-sm font-normal text-zinc-500"> l/h</span></p>
                    </div>
                  )}
                  {session.arrived_at && session.left_at && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Temps travaillé</p>
                      <p className="text-xl font-bold text-white">{formatDuration(new Date(session.left_at).getTime() - new Date(session.arrived_at).getTime())}</p>
                    </div>
                  )}
                  {session.pad_connected_at && session.pad_disconnected_at && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Production</p>
                      <p className="text-xl font-bold text-white">{formatDuration(new Date(session.pad_disconnected_at).getTime() - new Date(session.pad_connected_at).getTime())}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total lignes</p>
                    <p className="text-xl font-bold text-white tabular-nums">
                      {stats?.totalFinalLines ?? missions.reduce((a, m) => a + m.total_pad_lines, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Poids total</p>
                    <p className="text-xl font-bold text-white tabular-nums">
                      {Math.round(missions.reduce((a, m) => a + m.total_weight_kg, 0))} kg
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Détail missions */}
            {missions.length > 0 && (
              <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">Détail missions</p>
                <div className="flex flex-col gap-4">
                  {missions.map(m => {
                    const dMs = m.started_at && m.ended_at ? new Date(m.ended_at).getTime() - new Date(m.started_at).getTime() : null
                    const lph = dMs && dMs > 0 && m.total_pad_lines > 0 ? m.total_pad_lines / (dMs / 3_600_000) : null
                    const quais = m.supports?.filter(s => s.quai != null && s.quai !== '') ?? []
                    return (
                      <div key={m.id} className="border-b border-zinc-800 last:border-0 pb-4 last:pb-0 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white text-sm">
                            Mission #{m.mission_number} — {m.support_type === 'role' ? 'Roll' : 'Palette'} ×{m.support_count}
                          </span>
                          <span className="text-zinc-400 text-sm tabular-nums">{m.total_pad_lines} lig. · {m.total_weight_kg}kg</span>
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500">
                          <span>{formatTimestamp(m.started_at)} → {formatTimestamp(m.ended_at)}</span>
                        </div>
                        {(dMs !== null || lph !== null) && (
                          <div className="flex gap-3 text-xs">
                            {dMs !== null && <span className="text-zinc-600">{formatDuration(dMs)}</span>}
                            {lph !== null && <span className="text-zinc-500 font-medium">{formatLph(lph)} l/h</span>}
                          </div>
                        )}
                        {quais.length > 0 && (
                          <div className="flex gap-3 flex-wrap">
                            {quais.map(s => (
                              <span key={s.support_index} className="text-xs">
                                <span className="text-zinc-600">{s.label} </span>
                                <span className="text-zinc-300 font-semibold">{s.quai}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {m.notes && <p className="text-xs text-zinc-500 leading-relaxed">{m.notes}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pauses */}
            {pauses.length > 0 && (
              <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">Pauses ({pauses.length})</p>
                <div className="flex flex-col gap-2 text-sm">
                  {pauses.map(p => (
                    <div key={p.id} className="flex justify-between items-center">
                      <span className="text-zinc-500">{formatTimestamp(p.started_at)} → {formatTimestamp(p.ended_at)}</span>
                      <span className={p.is_system_deducted ? 'text-amber-400 text-xs' : 'text-zinc-600 text-xs'}>
                        {p.is_system_deducted ? 'décomptée' : 'non décomptée'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Injections */}
            {snapshots.length > 0 && (
              <div className="bg-zinc-900/50 rounded-2xl border border-white/[0.06] p-4">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3">Injections ({snapshots.length})</p>
                <div className="flex flex-col gap-2 text-sm">
                  {snapshots.map(s => (
                    <div key={s.id} className="flex justify-between">
                      <span className="text-zinc-500">{formatTimestamp(s.recorded_at)}</span>
                      <span className="text-white font-semibold tabular-nums">{s.total_final_lines} lignes finales</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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


      {confirmAction && (
        <Modal
          title={confirmAction === 'endMission' ? 'Terminer la mission ?' : 'Déconnecter le pad ?'}
          onClose={() => setConfirmAction(null)}
        >
          <div className="flex flex-col gap-4">
            {confirmAction === 'endMission' ? (
              <div className="flex flex-col gap-2">
                {activeMission?.supports?.some(s => s.quai) && (
                  <div className="bg-zinc-800/60 border border-white/[0.06] rounded-xl px-3 py-2 flex flex-col gap-1">
                    {activeMission.supports!.filter(s => s.quai).map(s => (
                      <div key={s.support_index} className="flex justify-between text-xs">
                        <span className="text-zinc-500">{s.label}</span>
                        <span className="text-zinc-300 font-semibold">{s.quai}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                Le pad sera déconnecté. Les calculs de productivité s&apos;arrêteront.
              </p>
            )}
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
