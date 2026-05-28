import { Mission, Pause, ProductionSnapshot, ProductivityStats, WorkSession } from '@/types'

function msDiff(start: string | null, end: Date | string): number {
  if (!start) return 0
  return new Date(end).getTime() - new Date(start).getTime()
}

function msToHours(ms: number): number {
  return ms / 3_600_000
}

function completedPausesMs(pauses: Pause[], systemOnly: boolean): number {
  return pauses
    .filter(p => p.ended_at && (!systemOnly || p.is_system_deducted))
    .reduce((acc, p) => acc + msDiff(p.started_at, p.ended_at!), 0)
}

// Pad = temps total − pauses décomptées système
function calcPadLph(
  session: WorkSession,
  pauses: Pause[],
  lines: number,
  now: Date
): number | null {
  if (!session.pad_connected_at || lines === 0) return null
  const ref = session.pad_disconnected_at ?? now
  const totalMs = msDiff(session.pad_connected_at, ref)
  const effectiveHours = msToHours(totalMs - completedPausesMs(pauses, true))
  if (effectiveHours <= 0) return null
  return lines / effectiveHours
}

// Théorique = temps total − toutes les pauses
function calcTheoreticalLph(
  session: WorkSession,
  pauses: Pause[],
  lines: number,
  now: Date
): number | null {
  if (!session.pad_connected_at || lines === 0) return null
  const ref = session.pad_disconnected_at ?? now
  const totalMs = msDiff(session.pad_connected_at, ref)
  const effectiveHours = msToHours(totalMs - completedPausesMs(pauses, false))
  if (effectiveHours <= 0) return null
  return lines / effectiveHours
}

// Réel = lignes / temps brut depuis connexion pad (aucune pause déduite)
function calcRealLph(session: WorkSession, lines: number, now: Date): number | null {
  if (!session.pad_connected_at || lines === 0) return null
  const ref = session.pad_disconnected_at ?? now
  const hours = msToHours(msDiff(session.pad_connected_at, ref))
  if (hours <= 0) return null
  return lines / hours
}


// Temps mort : segment courant (se remet à 0 à chaque mission) + total cumulé
function calcDeadTimes(
  session: WorkSession,
  missions: Mission[],
  now: Date
): { current: number | null; total: number | null } {
  if (!session.pad_connected_at) return { current: null, total: null }

  const completedSorted = missions
    .filter(m => m.started_at && m.ended_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime())

  const activeMission = missions.find(m => m.started_at && !m.ended_at) ?? null

  // Accumule les segments d'attente entre missions terminées
  let pastMs = 0
  let idleStart: string = session.pad_connected_at
  for (const m of completedSorted) {
    pastMs += Math.max(0, msDiff(idleStart, m.started_at!))
    idleStart = m.ended_at!
  }

  // Segment en cours : figé si mission active, ticking sinon
  const segmentEnd = activeMission?.started_at ? new Date(activeMission.started_at) : now
  const current = Math.max(0, msDiff(idleStart, segmentEnd))

  return { current, total: pastMs + current }
}

export function calcStats(
  session: WorkSession,
  missions: Mission[],
  pauses: Pause[],
  snapshots: ProductionSnapshot[],
  targetLph: number,
  now: Date = new Date()
): ProductivityStats {
  const latestSnapshot = snapshots.length
    ? snapshots.reduce((a, b) =>
        new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b
      )
    : null

  const hasSnapshot = !!latestSnapshot
  const snapshotLines = latestSnapshot?.total_final_lines ?? 0

  // Calcul des lignes hors snapshot
  let extraLines = 0

  if (!latestSnapshot) {
    // Sans snapshot : somme de toutes les missions terminées
    extraLines = missions
      .filter(m => m.ended_at)
      .reduce((acc, m) => acc + m.total_pad_lines, 0)
  } else {
    const snapshotTime = new Date(latestSnapshot.recorded_at)

    // Lignes des missions terminées AVANT le snapshot → déjà incluses dans total_final_lines
    const linesBeforeSnapshot = missions
      .filter(m => m.ended_at && new Date(m.ended_at) <= snapshotTime)
      .reduce((acc, m) => acc + m.total_pad_lines, 0)

    // Mission active PENDANT le snapshot (démarrée avant, terminée après) :
    // ajouter uniquement les lignes faites APRÈS le snapshot
    const missionDuringSnapshot = missions.find(m =>
      m.ended_at &&
      m.started_at &&
      new Date(m.started_at) <= snapshotTime &&
      new Date(m.ended_at) > snapshotTime
    )

    if (missionDuringSnapshot) {
      if (latestSnapshot.remaining_command_lines != null) {
        // L'utilisateur a saisi manuellement les lignes restantes (régule)
        extraLines += latestSnapshot.remaining_command_lines
      } else {
        // Calcul naturel : total mission − part déjà comptée dans le snapshot
        const alreadyCounted = Math.max(0, snapshotLines - linesBeforeSnapshot)
        extraLines += Math.max(0, missionDuringSnapshot.total_pad_lines - alreadyCounted)
      }
    }

    // Missions démarrées entièrement APRÈS le snapshot → toutes leurs lignes
    extraLines += missions
      .filter(m => m.ended_at && m.started_at && new Date(m.started_at) > snapshotTime)
      .reduce((acc, m) => acc + m.total_pad_lines, 0)
  }

  const effectiveTotalLines = (snapshotLines + extraLines) || null

  const activeMission = missions.find(m => m.started_at && !m.ended_at) ?? null
  const theoreticalForProjection = effectiveTotalLines
    ? calcTheoreticalLph(session, pauses, effectiveTotalLines, now)
    : null
  const pace = theoreticalForProjection ?? targetLph

  let projectedEndTime: Date | null = null
  let projectedRemainingLines: number | null = null

  if (activeMission?.started_at && activeMission.total_pad_lines > 0) {
    const elapsedMissionHours = msToHours(now.getTime() - new Date(activeMission.started_at).getTime())
    const remaining = Math.max(0, activeMission.total_pad_lines - pace * elapsedMissionHours)
    projectedRemainingLines = Math.round(remaining)
    projectedEndTime = new Date(now.getTime() + remaining / pace * 3_600_000)
  }

  const { current: currentDeadTimeMs, total: totalDeadTimeMs } = calcDeadTimes(session, missions, now)

  if (!effectiveTotalLines) {
    return {
      pad: null,
      theoretical: null,
      real: null,
      targetLph,
      diffLph: null,
      diffLinesTotal: null,
      cushionMs: null,
      projectedEndTime,
      projectedRemainingLines,
      cushionLph: null,
      totalFinalLines: null,
      hasSnapshot: false,
      currentDeadTimeMs,
      totalDeadTimeMs,
    }
  }

  const pad = calcPadLph(session, pauses, effectiveTotalLines, now)
  const theoretical = theoreticalForProjection
  const real = calcRealLph(session, effectiveTotalLines, now)

  const diffLph = theoretical !== null ? theoretical - targetLph : null
  const cushionLph = diffLph

  let diffLinesTotal: number | null = null
  let cushionMs: number | null = null
  if (theoretical !== null && session.pad_connected_at) {
    const allPausesMs = completedPausesMs(pauses, false)
    const ref = session.pad_disconnected_at ?? now
    const effectiveHours = msToHours(
      new Date(ref).getTime() - new Date(session.pad_connected_at).getTime() - allPausesMs
    )
    // Valeur continue (non arrondie) pour un décompte fluide seconde par seconde
    const diffLinesContinuous = effectiveTotalLines - targetLph * effectiveHours
    diffLinesTotal = Math.round(diffLinesContinuous)
    cushionMs = Math.abs(diffLinesContinuous / targetLph) * 3_600_000
  }

  return {
    pad,
    theoretical,
    real,
    targetLph,
    diffLph,
    diffLinesTotal,
    cushionMs,
    projectedEndTime,
    projectedRemainingLines,
    cushionLph,
    totalFinalLines: effectiveTotalLines,
    hasSnapshot,
    currentDeadTimeMs,
    totalDeadTimeMs,
  }
}

export function formatLph(lph: number | null): string {
  if (lph === null) return '—'
  return lph.toFixed(1)
}

export function formatTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDeadTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}min`
  return `${hours}h${String(minutes).padStart(2, '0')}`
}

export function lphColor(lph: number | null, target: number): string {
  if (lph === null) return 'text-gray-500'
  const ratio = lph / target
  if (ratio >= 1.05) return 'text-green-400'
  if (ratio >= 0.95) return 'text-amber-400'
  return 'text-red-400'
}
