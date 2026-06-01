'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { WorkSession, Mission, Pause, ProductionSnapshot } from '@/types'
import { calcStats, formatDuration, formatLph } from '@/lib/productivity'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, PieChart, Pie, Legend,
} from 'recharts'

interface DayData {
  session: WorkSession
  missions: Mission[]
  pauses: Pause[]
  snapshots: ProductionSnapshot[]
  lphReal: number | null   // theoretical = Réel dans l'UI
  totalLines: number | null
  deadTimeMs: number | null
  workMs: number | null
  prodMs: number | null
  totalWeight: number
}

function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const C = { green: '#34d399', amber: '#fbbf24', red: '#f87171', blue: '#3b82f6', orange: '#f97316', purple: '#a78bfa', teal: '#2dd4bf' }

function MiniCard({ label, value, color = '#fff' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-3 flex flex-col gap-1">
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold leading-tight">{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
    </div>
  )
}

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-zinc-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#fff' }} className="font-semibold">{p.name ? `${p.name} : ` : ''}{p.value}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [days, setDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [targetLph, setTargetLph] = useState(80)

  useEffect(() => { loadMonth() }, [year, month])

  async function loadMonth() {
    setLoading(true)
    try {
      const [sessionsRes, profileRes] = await Promise.all([
        fetch(`/api/sessions/history?month=${year}-${String(month).padStart(2, '0')}`),
        fetch('/api/profile'),
      ])
      const sessions: WorkSession[] = await sessionsRes.json()
      const profile = await profileRes.json()
      if (profile?.target_lph) setTargetLph(profile.target_lph)
      if (!sessions?.length) { setDays([]); return }

      const enriched: DayData[] = await Promise.all(
        sessions.map(async s => {
          const [m, p, sn] = await Promise.all([
            fetch(`/api/missions?session_id=${s.id}`).then(r => r.json()).catch(() => []),
            fetch(`/api/pauses?session_id=${s.id}`).then(r => r.json()).catch(() => []),
            fetch(`/api/snapshots?session_id=${s.id}`).then(r => r.json()).catch(() => []),
          ])
          const ref = s.pad_disconnected_at ?? s.left_at ?? new Date().toISOString()
          const st = calcStats(s, m ?? [], p ?? [], sn ?? [], profile?.target_lph ?? 80, new Date(ref))
          return {
            session: s, missions: m ?? [], pauses: p ?? [], snapshots: sn ?? [],
            lphReal: st.theoretical,
            totalLines: st.totalFinalLines,
            deadTimeMs: st.totalDeadTimeMs,
            workMs: s.arrived_at && s.left_at ? new Date(s.left_at).getTime() - new Date(s.arrived_at).getTime() : null,
            prodMs: s.pad_connected_at && s.pad_disconnected_at ? new Date(s.pad_disconnected_at).getTime() - new Date(s.pad_connected_at).getTime() : null,
            totalWeight: (m ?? []).reduce((a: number, x: Mission) => a + x.total_weight_kg, 0),
          }
        })
      )
      setDays(enriched.sort((a, b) => a.session.date.localeCompare(b.session.date)))
    } finally { setLoading(false) }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // ── Calculs ──────────────────────────────────────────────────
  const worked = days.filter(d => d.session.pad_connected_at)
  const n = worked.length || 1

  const allMissions = days.flatMap(d => d.missions)
  const rolls = allMissions.filter(m => m.support_type === 'role')
  const palettes = allMissions.filter(m => m.support_type === 'palette')

  const avgDeadMin = Math.round(worked.reduce((a, d) => a + (d.deadTimeMs ?? 0), 0) / n / 60000)
  const avgWorkMs = worked.filter(d => d.workMs).reduce((a, d) => a + (d.workMs ?? 0), 0) / worked.filter(d => d.workMs).length || 0
  const avgMissions = allMissions.length / n
  const avgWeight = worked.reduce((a, d) => a + d.totalWeight, 0) / n
  const avgRolls = rolls.length / n
  const avgPalettes = palettes.length / n
  const avgLines = worked.reduce((a, d) => a + (d.totalLines ?? 0), 0) / n

  // Moyenne vitesse mission (l/h) par jour = moyenne des l/h de chaque mission terminée
  const completedMissions = allMissions.filter(m => m.started_at && m.ended_at && m.total_pad_lines > 0)
  const missionLphs = completedMissions.map(m => {
    const ms = new Date(m.ended_at!).getTime() - new Date(m.started_at!).getTime()
    return ms > 0 ? m.total_pad_lines / (ms / 3_600_000) : 0
  }).filter(v => v > 0)
  const avgMissionLph = missionLphs.length ? missionLphs.reduce((a, b) => a + b, 0) / missionLphs.length : null

  const missionDurations = completedMissions.map(m =>
    new Date(m.ended_at!).getTime() - new Date(m.started_at!).getTime()
  )
  const avgMissionMs = missionDurations.length ? missionDurations.reduce((a, b) => a + b, 0) / missionDurations.length : 0

  const avgWeightPerRoll = rolls.length ? rolls.reduce((a, m) => a + m.total_weight_kg, 0) / rolls.length : null

  const totalPauseMs = worked.reduce((a, d) => {
    const dayPause = d.pauses.filter(p => p.ended_at).reduce((acc, p) => acc + new Date(p.ended_at!).getTime() - new Date(p.started_at).getTime(), 0)
    return a + dayPause
  }, 0)
  const avgPauseMs = n > 0 ? totalPauseMs / n : 0

  const daysWithLph = worked.filter(d => d.lphReal !== null)
  const avgMonthLph = daysWithLph.length ? daysWithLph.reduce((a, d) => a + (d.lphReal ?? 0), 0) / daysWithLph.length : null


  // Top 8 journées les plus chargées en poids
  const top8 = [...days]
    .filter(d => d.totalWeight > 0)
    .sort((a, b) => b.totalWeight - a.totalWeight)
    .slice(0, 8)
    .map(d => ({
      day: d.session.date.slice(5).replace('-', '/'),
      weight: Math.round(d.totalWeight),
    }))

  // Camembert 3D : répartition du temps moyen de travail
  const avgRollMs = worked.reduce((a, d) => {
    const rollTime = d.missions.filter(m => m.support_type === 'role' && m.started_at && m.ended_at)
      .reduce((acc, m) => acc + new Date(m.ended_at!).getTime() - new Date(m.started_at!).getTime(), 0)
    return a + rollTime
  }, 0) / n
  const avgPalMs = worked.reduce((a, d) => {
    const palTime = d.missions.filter(m => m.support_type === 'palette' && m.started_at && m.ended_at)
      .reduce((acc, m) => acc + new Date(m.ended_at!).getTime() - new Date(m.started_at!).getTime(), 0)
    return a + palTime
  }, 0) / n
  const avgDeadMs = worked.reduce((a, d) => a + (d.deadTimeMs ?? 0), 0) / n
  const pieTotal = avgRollMs + avgPalMs + avgDeadMs

  const pieData = pieTotal > 0 ? [
    { name: 'Rolls', value: Math.round(avgRollMs / 60000), pct: Math.round(avgRollMs / pieTotal * 100), color: C.blue },
    { name: 'Palettes', value: Math.round(avgPalMs / 60000), pct: Math.round(avgPalMs / pieTotal * 100), color: C.orange },
    { name: 'Temps mort', value: Math.round(avgDeadMs / 60000), pct: Math.round(avgDeadMs / pieTotal * 100), color: C.amber },
  ].filter(d => d.value > 0) : []

  // Heures productives
  const hourMap: Record<number, { total: number; count: number }> = {}
  days.forEach(d => d.missions.forEach(m => {
    if (!m.started_at || !m.ended_at || m.total_pad_lines === 0) return
    const ms = new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()
    if (ms <= 0) return
    const lph = m.total_pad_lines / (ms / 3_600_000)
    const h = parseInt(new Date(m.started_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }))
    if (!hourMap[h]) hourMap[h] = { total: 0, count: 0 }
    hourMap[h].total += lph; hourMap[h].count++
  }))
  const hourData = Object.entries(hourMap)
    .map(([h, { total, count }]) => ({ h: `${h}h`, lph: parseFloat((total / count).toFixed(1)) }))
    .sort((a, b) => parseInt(a.h) - parseInt(b.h))

  return (
    <>
      <TopBar title="Stats" />
      <main className="px-4 pt-4 pb-4 flex flex-col gap-5 max-w-lg mx-auto">

        {/* Sélecteur mois */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:text-white active:scale-[0.93] transition-all">
            <ChevronLeft size={18} />
          </button>
          <p className="text-base font-semibold text-white capitalize">{monthLabel(year, month)}</p>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:text-white disabled:opacity-30 active:scale-[0.93] transition-all">
            <ChevronRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-zinc-900 rounded-2xl animate-pulse border border-white/[0.04]" />)}
          </div>
        ) : days.length === 0 ? (
          <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-sm">Aucune session ce mois-ci</p>
          </div>
        ) : (
          <>
            {/* Jours travaillés */}
            <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl px-4 py-3 flex justify-between items-center">
              <p className="text-xs text-zinc-500">Jours travaillés</p>
              <p className="text-white font-bold text-xl tabular-nums">{worked.length}</p>
            </div>


            {/* Grille moyennes */}
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">Moyennes du mois</p>
              <div className="grid grid-cols-2 gap-2">
                <MiniCard label="Moy. l/h du mois" value={avgMonthLph !== null ? `${formatLph(avgMonthLph)} l/h` : '—'} color={avgMonthLph && avgMonthLph >= targetLph ? C.green : C.amber} />
                <MiniCard label="Temps mort / jour" value={`${avgDeadMin} min`} color={C.amber} />
                <MiniCard label="Temps de pause / jour" value={avgPauseMs > 0 ? formatDuration(avgPauseMs) : '—'} color={C.amber} />
                <MiniCard label="Temps de travail / jour" value={avgWorkMs > 0 ? formatDuration(avgWorkMs) : '—'} color={C.teal} />
                <MiniCard label="Missions / jour" value={avgMissions.toFixed(1)} color={C.blue} />
                <MiniCard label="Poids / jour" value={`${Math.round(avgWeight)} kg`} color={C.purple} />
                <MiniCard label="Rolls / jour" value={avgRolls.toFixed(1)} color={C.blue} />
                <MiniCard label="Palettes / jour" value={avgPalettes.toFixed(1)} color={C.orange} />
                <MiniCard label="Lignes finales / jour" value={Math.round(avgLines) > 0 ? String(Math.round(avgLines)) : '—'} color={C.green} />
                <MiniCard label="Vitesse mission" value={avgMissionLph !== null ? `${formatLph(avgMissionLph)} l/h` : '—'} color={C.green} />
                <MiniCard label="Durée mission moy." value={avgMissionMs > 0 ? formatDuration(avgMissionMs) : '—'} color={C.teal} />
                <MiniCard label="Poids / roll" value={avgWeightPerRoll !== null ? `${Math.round(avgWeightPerRoll)} kg` : '—'} color={C.purple} />
              </div>
            </div>

            {/* Top 8 journées les plus chargées */}
            {top8.length > 0 && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Top 8 journées (poids)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={top8} layout="vertical" barSize={14} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="day" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="weight" name="kg" radius={[0, 4, 4, 0]}>
                      {top8.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? C.green : i < 3 ? C.amber : C.blue} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Camembert 3D répartition temps */}
            {pieData.length > 0 && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Répartition temps de travail moyen</p>
                <p className="text-[9px] text-zinc-600 mb-3">Roll · Palette · Temps mort</p>
                <div className="flex items-center gap-4">
                  {/* Effet 3D via perspective CSS */}
                  <div style={{ perspective: '600px' }} className="shrink-0">
                    <div style={{ transform: 'rotateX(30deg)', transformOrigin: 'center center' }}>
                      <PieChart width={140} height={100}>
                        {/* Ombre basse (effet 3D) */}
                        <Pie data={pieData} cx={65} cy={62} outerRadius={46} innerRadius={0} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.3} />)}
                        </Pie>
                        {/* Surface principale */}
                        <Pie data={pieData} cx={65} cy={52} outerRadius={46} innerRadius={18} dataKey="value" strokeWidth={2} stroke="#18181b" startAngle={90} endAngle={-270}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-zinc-400 text-xs flex-1">{d.name}</span>
                        <span className="text-white font-bold text-sm tabular-nums">{Math.round(d.value)}min</span>
                        <span className="text-zinc-600 text-xs w-9 text-right">{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Heures productives */}
            {hourData.length > 0 && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Productivité par heure</p>
                <p className="text-[9px] text-zinc-600 mb-3">Moy. l/h par tranche de démarrage de mission</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={hourData} barSize={18} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="h" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <ReferenceLine y={targetLph} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5} />
                    <Bar dataKey="lph" name="l/h" radius={[4, 4, 0, 0]}>
                      {hourData.map((d, i) => (
                        <Cell key={i} fill={d.lph >= targetLph * 1.05 ? C.green : d.lph >= targetLph * 0.95 ? C.amber : C.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
