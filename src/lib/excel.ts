import * as XLSX from 'xlsx'
import { Mission, Pause, ProductionSnapshot, WorkSession } from '@/types'
import { formatDuration } from './productivity'

interface ExportData {
  sessions: Array<WorkSession & {
    missions: Mission[]
    pauses: Pause[]
    snapshots: ProductionSnapshot[]
    pseudo: string
  }>
  month: number
  year: number
}

function msDiff(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return new Date(b).getTime() - new Date(a).getTime()
}

function effectiveHours(session: WorkSession, pauses: Pause[]): number {
  const ref = session.pad_disconnected_at ?? session.left_at ?? new Date().toISOString()
  if (!session.pad_connected_at) return 0
  const totalMs = msDiff(session.pad_connected_at, ref)
  const allPausesMs = pauses
    .filter(p => p.ended_at)
    .reduce((acc, p) => acc + msDiff(p.started_at, p.ended_at), 0)
  return Math.max(0, (totalMs - allPausesMs) / 3_600_000)
}

export function buildExcel({ sessions, month, year }: ExportData): Uint8Array {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Détail par session
  const detailRows: unknown[][] = [
    ['Date', 'Arrivée', 'Connexion pad', 'Déco pad', 'Départ', 'Lignes finales',
     'Lignes/h Théo', 'Missions', 'Poids total (kg)', 'Nb pauses', 'Durée pauses (min)'],
  ]

  for (const s of sessions) {
    const latestSnap = s.snapshots.length
      ? s.snapshots.reduce((a, b) =>
          new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b
        )
      : null
    const lines = latestSnap?.total_final_lines ?? 0
    const effH = effectiveHours(s, s.pauses)
    const lph = effH > 0 ? lines / effH : 0
    const totalPauseMs = s.pauses
      .filter(p => p.ended_at)
      .reduce((acc, p) => acc + msDiff(p.started_at, p.ended_at), 0)
    const totalWeight = s.missions.reduce((acc, m) => acc + (m.total_weight_kg || 0), 0)

    detailRows.push([
      s.date,
      s.arrived_at ? new Date(s.arrived_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      s.pad_connected_at ? new Date(s.pad_connected_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      s.pad_disconnected_at ? new Date(s.pad_disconnected_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      s.left_at ? new Date(s.left_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      lines,
      lph > 0 ? Math.round(lph * 10) / 10 : '',
      s.missions.length,
      Math.round(totalWeight * 10) / 10,
      s.pauses.length,
      Math.round(totalPauseMs / 60_000),
    ])
  }

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
  wsDetail['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail sessions')

  // Sheet 2: Détail missions
  const missionRows: unknown[][] = [
    ['Date', 'Mission #', 'Type', 'Supports', 'Lignes pad', 'Poids (kg)', 'Litres',
     'Début', 'Fin', 'Durée'],
  ]
  for (const s of sessions) {
    for (const m of s.missions) {
      const dur = m.started_at && m.ended_at ? msDiff(m.started_at, m.ended_at) : 0
      missionRows.push([
        s.date,
        m.mission_number,
        m.support_type === 'role' ? 'Rôle' : 'Palette',
        m.support_count,
        m.total_pad_lines,
        m.total_weight_kg,
        m.total_liters ?? '',
        m.started_at ? new Date(m.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        m.ended_at ? new Date(m.ended_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        dur ? formatDuration(dur) : '',
      ])
    }
  }
  const wsMissions = XLSX.utils.aoa_to_sheet(missionRows)
  XLSX.utils.book_append_sheet(wb, wsMissions, 'Missions')

  // Sheet 3: Stats mensuelles
  const allLines = sessions.map(s => {
    const snap = s.snapshots.length
      ? s.snapshots.reduce((a, b) =>
          new Date(a.recorded_at) > new Date(b.recorded_at) ? a : b
        )
      : null
    const lines = snap?.total_final_lines ?? 0
    const effH = effectiveHours(s, s.pauses)
    return { lines, effH, lph: effH > 0 ? lines / effH : 0 }
  })

  const joursAvecDonnees = allLines.filter(x => x.lines > 0)
  const avgLph = joursAvecDonnees.length
    ? joursAvecDonnees.reduce((a, b) => a + b.lph, 0) / joursAvecDonnees.length
    : 0
  const totalLines = allLines.reduce((a, b) => a + b.lines, 0)
  const totalWeight = sessions.flatMap(s => s.missions).reduce(
    (a, m) => a + (m.total_weight_kg || 0), 0
  )
  const rolesCount = sessions.flatMap(s => s.missions).filter(m => m.support_type === 'role').length
  const palettesCount = sessions.flatMap(s => s.missions).filter(m => m.support_type === 'palette').length

  const monthName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' })

  const statsRows: unknown[][] = [
    [`Statistiques ${monthName} ${year}`],
    [],
    ['Journées travaillées', sessions.length],
    ['Total lignes finales', totalLines],
    ['Moyenne lignes/h théorique', Math.round(avgLph * 10) / 10],
    ['Total poids (kg)', Math.round(totalWeight)],
    [],
    ['Missions rôles', rolesCount],
    ['Missions palettes', palettesCount],
    ['% rôles', rolesCount + palettesCount > 0 ? `${Math.round(rolesCount / (rolesCount + palettesCount) * 100)}%` : '—'],
  ]

  const wsStats = XLSX.utils.aoa_to_sheet(statsRows)
  wsStats['!cols'] = [{ wch: 30 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsStats, 'Stats mensuelles')

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}
