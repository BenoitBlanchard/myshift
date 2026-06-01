import * as XLSX from 'xlsx'
import { Mission, MissionSupport, Pause, ProductionSnapshot, WorkSession } from '@/types'
import { formatDuration } from './productivity'

interface SessionWithData extends WorkSession {
  missions: (Mission & { mission_supports?: MissionSupport[] })[]
  pauses: Pause[]
  snapshots: ProductionSnapshot[]
  pseudo: string
}

interface ExportData {
  sessions: SessionWithData[]
  month: number
  year: number
}

function msDiff(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return new Date(b).getTime() - new Date(a).getTime()
}

function fmt(ts: string | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  })
}

// Réel = temps pad − pauses système uniquement
function realEffectiveHours(session: WorkSession, pauses: Pause[]): number {
  const ref = session.pad_disconnected_at ?? new Date().toISOString()
  if (!session.pad_connected_at) return 0
  const totalMs = msDiff(session.pad_connected_at, ref)
  const systemPausesMs = pauses
    .filter(p => p.ended_at && p.is_system_deducted)
    .reduce((acc, p) => acc + msDiff(p.started_at, p.ended_at), 0)
  return Math.max(0, (totalMs - systemPausesMs) / 3_600_000)
}

function quaiLabel(m: Mission & { mission_supports?: MissionSupport[] }): string {
  const supports = m.mission_supports ?? []
  const withQuai = supports.filter(s => s.quai)
  if (!withQuai.length) return ''
  return withQuai.map(s => `${s.label}: ${s.quai}`).join(' / ')
}

export function buildExcel({ sessions, month, year }: ExportData): Uint8Array {
  const wb = XLSX.utils.book_new()

  // ── Feuille 1 : Détail sessions ────────────────────────────
  const detailRows: unknown[][] = [[
    'Date', 'Arrivée', 'Connexion pad', 'Déco pad', 'Départ',
    'Temps travaillé', 'Temps production', 'Temps mort (min)',
    'Lignes finales', 'l/h Réel',
    'Missions', 'Rolls', 'Palettes',
    'Poids total (kg)', 'Nb pauses', 'Durée pauses (min)',
  ]]

  for (const s of sessions) {
    const latestSnap = s.snapshots.length
      ? s.snapshots.reduce((a, b) => new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b)
      : null
    const lines = latestSnap?.total_final_lines ?? 0
    const effH = realEffectiveHours(s, s.pauses)
    const lph = effH > 0 && lines > 0 ? Math.round(lines / effH * 10) / 10 : ''

    const workMs = msDiff(s.arrived_at, s.left_at)
    const prodMs = msDiff(s.pad_connected_at, s.pad_disconnected_at)
    const allPausesMs = s.pauses.filter(p => p.ended_at).reduce((a, p) => a + msDiff(p.started_at, p.ended_at), 0)

    // Temps mort = prod − temps missions
    const missionMs = s.missions
      .filter(m => m.started_at && m.ended_at)
      .reduce((a, m) => a + msDiff(m.started_at, m.ended_at), 0)
    const deadMs = Math.max(0, prodMs - missionMs)

    const totalWeight = s.missions.reduce((a, m) => a + (m.total_weight_kg || 0), 0)
    const rolls = s.missions.filter(m => m.support_type === 'role').length
    const palettes = s.missions.filter(m => m.support_type === 'palette').length

    detailRows.push([
      s.date,
      fmt(s.arrived_at),
      fmt(s.pad_connected_at),
      fmt(s.pad_disconnected_at),
      fmt(s.left_at),
      workMs > 0 ? formatDuration(workMs) : '',
      prodMs > 0 ? formatDuration(prodMs) : '',
      deadMs > 0 ? Math.round(deadMs / 60_000) : 0,
      lines || '',
      lph,
      s.missions.length,
      rolls,
      palettes,
      Math.round(totalWeight * 10) / 10,
      s.pauses.length,
      Math.round(allPausesMs / 60_000),
    ])
  }

  const ws1 = XLSX.utils.aoa_to_sheet(detailRows)
  ws1['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 10 },
    { wch: 16 }, { wch: 10 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Détail sessions')

  // ── Feuille 2 : Détail missions ────────────────────────────
  const missionRows: unknown[][] = [[
    'Date', 'Mission #', 'Type', 'Supports',
    'Lignes pad', 'Poids (kg)',
    'Début', 'Fin', 'Durée', 'l/h',
    'Quai', 'Notes',
  ]]

  for (const s of sessions) {
    for (const m of s.missions) {
      const durMs = m.started_at && m.ended_at ? msDiff(m.started_at, m.ended_at) : 0
      const lph = durMs > 0 && m.total_pad_lines > 0
        ? Math.round(m.total_pad_lines / (durMs / 3_600_000) * 10) / 10
        : ''
      missionRows.push([
        s.date,
        m.mission_number,
        m.support_type === 'role' ? 'Roll' : 'Palette',
        m.support_count,
        m.total_pad_lines,
        m.total_weight_kg,
        fmt(m.started_at),
        fmt(m.ended_at),
        durMs ? formatDuration(durMs) : '',
        lph,
        quaiLabel(m),
        m.notes ?? '',
      ])
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(missionRows)
  ws2['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 },
    { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 30 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Missions')

  // ── Feuille 3 : Stats mensuelles ───────────────────────────
  const allMissions = sessions.flatMap(s => s.missions)
  const rolls = allMissions.filter(m => m.support_type === 'role')
  const palettes = allMissions.filter(m => m.support_type === 'palette')
  const n = sessions.length || 1

  const totalLinesAll = sessions.reduce((a, s) => {
    const snap = s.snapshots.length
      ? s.snapshots.reduce((x, y) => new Date(x.recorded_at) > new Date(y.recorded_at) ? x : y)
      : null
    return a + (snap?.total_final_lines ?? 0)
  }, 0)
  const totalWeight = allMissions.reduce((a, m) => a + (m.total_weight_kg || 0), 0)

  const daysWithLph = sessions.filter(s => s.pad_connected_at && s.pad_disconnected_at)
  const avgLph = daysWithLph.length
    ? daysWithLph.reduce((a, s) => {
        const snap = s.snapshots.length
          ? s.snapshots.reduce((x, y) => new Date(x.recorded_at) > new Date(y.recorded_at) ? x : y)
          : null
        const lines = snap?.total_final_lines ?? 0
        const effH = realEffectiveHours(s, s.pauses)
        return a + (effH > 0 ? lines / effH : 0)
      }, 0) / daysWithLph.length
    : 0

  const totalWorkMs = sessions.reduce((a, s) => a + msDiff(s.arrived_at, s.left_at), 0)
  const totalProdMs = sessions.reduce((a, s) => a + msDiff(s.pad_connected_at, s.pad_disconnected_at), 0)
  const totalPauseMs = sessions.flatMap(s => s.pauses)
    .filter(p => p.ended_at)
    .reduce((a, p) => a + msDiff(p.started_at, p.ended_at), 0)

  const completedMissions = allMissions.filter(m => m.started_at && m.ended_at && m.total_pad_lines > 0)
  const avgMissionLph = completedMissions.length
    ? completedMissions.reduce((a, m) => {
        const ms = msDiff(m.started_at, m.ended_at)
        return a + (ms > 0 ? m.total_pad_lines / (ms / 3_600_000) : 0)
      }, 0) / completedMissions.length
    : 0
  const avgMissionMs = completedMissions.length
    ? completedMissions.reduce((a, m) => a + msDiff(m.started_at, m.ended_at), 0) / completedMissions.length
    : 0
  const avgWeightPerRoll = rolls.length
    ? rolls.reduce((a, m) => a + m.total_weight_kg, 0) / rolls.length
    : 0

  const monthName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' })

  const statsRows: unknown[][] = [
    [`Statistiques ${monthName} ${year}`],
    [],
    ['JOURNÉES', ''],
    ['Journées travaillées', sessions.length],
    ['Temps travaillé total', totalWorkMs > 0 ? formatDuration(totalWorkMs) : '—'],
    ['Temps de production total', totalProdMs > 0 ? formatDuration(totalProdMs) : '—'],
    ['Temps travaillé moy. / jour', totalWorkMs > 0 ? formatDuration(totalWorkMs / n) : '—'],
    ['Temps production moy. / jour', totalProdMs > 0 ? formatDuration(totalProdMs / n) : '—'],
    [],
    ['PRODUCTIVITÉ', ''],
    ['Lignes finales totales', totalLinesAll],
    ['Moyenne l/h Réel du mois', avgLph > 0 ? Math.round(avgLph * 10) / 10 : '—'],
    ['Lignes finales moy. / jour', n > 0 ? Math.round(totalLinesAll / n) : '—'],
    ['Vitesse mission moy. (l/h)', avgMissionLph > 0 ? Math.round(avgMissionLph * 10) / 10 : '—'],
    ['Durée mission moy.', avgMissionMs > 0 ? formatDuration(avgMissionMs) : '—'],
    [],
    ['MISSIONS', ''],
    ['Total missions', allMissions.length],
    ['Missions / jour (moy.)', Math.round(allMissions.length / n * 10) / 10],
    ['Missions rolls', rolls.length],
    ['Missions palettes', palettes.length],
    ['% rolls', rolls.length + palettes.length > 0 ? `${Math.round(rolls.length / (rolls.length + palettes.length) * 100)}%` : '—'],
    [],
    ['POIDS', ''],
    ['Poids total (kg)', Math.round(totalWeight)],
    ['Poids moy. / jour (kg)', Math.round(totalWeight / n)],
    ['Poids moy. / roll (kg)', avgWeightPerRoll > 0 ? Math.round(avgWeightPerRoll) : '—'],
    [],
    ['PAUSES & TEMPS MORT', ''],
    ['Durée pauses totale', totalPauseMs > 0 ? formatDuration(totalPauseMs) : '—'],
    ['Durée pauses moy. / jour', totalPauseMs > 0 ? formatDuration(totalPauseMs / n) : '—'],
  ]

  const ws3 = XLSX.utils.aoa_to_sheet(statsRows)
  ws3['!cols'] = [{ wch: 35 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Stats mensuelles')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}
