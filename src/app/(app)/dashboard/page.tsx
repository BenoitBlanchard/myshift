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
  lph: number | null
  theoretical: number | null
  totalLines: number | null
  deadTimeMs: number | null
  workMs: number | null
  prodMs: number | null
}

function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const COLORS = { roll: '#3b82f6', palette: '#f59e0b', good: '#34d399', warn: '#fbbf24', bad: '#f87171' }

function StatCard({ label, value, sub, color = 'white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-3 flex flex-col gap-0.5">
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight`} style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}

// Tooltip sombre personnalisé
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: {value: number; name?: string; color?: string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-zinc-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#fff' }} className="font-semibold">{p.name ? `${p.name}: ` : ''}{p.value}</p>
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

  useEffect(() => {
    loadMonth()
  }, [year, month])

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
            session: s,
            missions: m ?? [],
            pauses: p ?? [],
            snapshots: sn ?? [],
            lph: st.pad,
            theoretical: st.theoretical,
            totalLines: st.totalFinalLines,
            deadTimeMs: st.totalDeadTimeMs,
            workMs: s.arrived_at && s.left_at
              ? new Date(s.left_at).getTime() - new Date(s.arrived_at).getTime() : null,
            prodMs: s.pad_connected_at && s.pad_disconnected_at
              ? new Date(s.pad_disconnected_at).getTime() - new Date(s.pad_connected_at).getTime() : null,
          }
        })
      )
      setDays(enriched.sort((a, b) => a.session.date.localeCompare(b.session.date)))
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    const n = new Date()
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // ── Calculs agrégés ──────────────────────────────────────────
  const worked = days.filter(d => d.session.pad_connected_at)
  const avgLph = worked.length ? worked.reduce((a, d) => a + (d.lph ?? 0), 0) / worked.filter(d => d.lph).length : null
  const totalLines = days.reduce((a, d) => a + (d.totalLines ?? 0), 0)
  const totalProdMs = days.reduce((a, d) => a + (d.prodMs ?? 0), 0)
  const avgDeadMin = worked.length
    ? Math.round(worked.reduce((a, d) => a + (d.deadTimeMs ?? 0), 0) / worked.length / 60000)
    : null

  // Données barres quotidiennes
  const barData = days.map(d => {
    const day = parseInt(d.session.date.split('-')[2])
    return {
      day: `${day}`,
      lph: d.lph !== null ? parseFloat((d.lph).toFixed(1)) : 0,
      lines: d.totalLines ?? 0,
      dead: d.deadTimeMs !== null ? Math.round(d.deadTimeMs / 60000) : 0,
    }
  })

  // Heures productives — l/h moyen par heure de début de mission
  const hourMap: Record<number, { total: number; count: number }> = {}
  days.forEach(d => {
    d.missions.forEach(m => {
      if (!m.started_at || !m.ended_at) return
      const durMs = new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()
      if (durMs <= 0 || m.total_pad_lines === 0) return
      const lph = m.total_pad_lines / (durMs / 3_600_000)
      const hour = new Date(m.started_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).replace('h', '')
      const h = parseInt(hour)
      if (!hourMap[h]) hourMap[h] = { total: 0, count: 0 }
      hourMap[h].total += lph
      hourMap[h].count++
    })
  })
  const hourData = Object.entries(hourMap)
    .map(([h, { total, count }]) => ({ h: `${h}h`, lph: parseFloat((total / count).toFixed(1)) }))
    .sort((a, b) => parseInt(a.h) - parseInt(b.h))

  // Roll vs Palette
  let rolls = 0, palettes = 0
  days.forEach(d => d.missions.forEach(m => {
    if (m.support_type === 'role') rolls++
    else palettes++
  }))
  const total = rolls + palettes
  const pieData = total > 0 ? [
    { name: 'Rolls', value: rolls, pct: Math.round(rolls / total * 100) },
    { name: 'Palettes', value: palettes, pct: Math.round(palettes / total * 100) },
  ] : []

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
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-zinc-900 rounded-2xl animate-pulse border border-white/[0.04]" />)}
          </div>
        ) : days.length === 0 ? (
          <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-sm">Aucune session ce mois-ci</p>
          </div>
        ) : (
          <>
            {/* Résumé */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Jours travaillés" value={String(worked.length)} sub={`${days.length} enregistré${days.length > 1 ? 's' : ''}`} />
              <StatCard label="Moy. PAD" value={avgLph !== null ? `${formatLph(avgLph)} l/h` : '—'} color={avgLph && avgLph >= targetLph ? COLORS.good : COLORS.warn} />
              <StatCard label="Total lignes finales" value={totalLines > 0 ? String(totalLines) : '—'} />
              <StatCard label="Temps production" value={totalProdMs > 0 ? formatDuration(totalProdMs) : '—'} sub="cumulé du mois" />
            </div>
            {avgDeadMin !== null && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl px-4 py-3 flex justify-between items-center">
                <p className="text-xs text-zinc-500">Temps mort moyen / jour</p>
                <p className="text-amber-400 font-bold text-lg tabular-nums">{avgDeadMin}min</p>
              </div>
            )}

            {/* Productivité PAD quotidienne */}
            {barData.length > 0 && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">PAD l/h par jour</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData} barSize={barData.length > 15 ? 10 : 16} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <ReferenceLine y={targetLph} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5} />
                    <Bar dataKey="lph" name="l/h" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={d.lph >= targetLph * 1.05 ? COLORS.good : d.lph >= targetLph * 0.95 ? COLORS.warn : d.lph > 0 ? COLORS.bad : '#3f3f46'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-indigo-400 mt-1">— objectif {targetLph} l/h</p>
              </div>
            )}

            {/* Lignes finales par jour */}
            {barData.some(d => d.lines > 0) && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Lignes finales par jour</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={barData} barSize={barData.length > 15 ? 10 : 16} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="lines" name="lignes" radius={[4, 4, 0, 0]} fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Temps mort par jour */}
            {barData.some(d => d.dead > 0) && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Temps mort par jour (min)</p>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={barData} barSize={barData.length > 15 ? 10 : 16} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="dead" name="min" radius={[4, 4, 0, 0]} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Heures productives */}
            {hourData.length > 0 && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Productivité par heure</p>
                <p className="text-[10px] text-zinc-600 mb-3">Moy. l/h des missions démarrées dans chaque tranche</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={hourData} barSize={18} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="h" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <ReferenceLine y={targetLph} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5} />
                    <Bar dataKey="lph" name="l/h" radius={[4, 4, 0, 0]}>
                      {hourData.map((d, i) => (
                        <Cell key={i} fill={d.lph >= targetLph * 1.05 ? COLORS.good : d.lph >= targetLph * 0.95 ? COLORS.warn : COLORS.bad} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Roll vs Palette */}
            {pieData.length > 0 && (
              <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Répartition missions</p>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <PieChart width={120} height={120}>
                      <Pie data={pieData} cx={55} cy={55} innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                        <Cell fill={COLORS.roll} />
                        <Cell fill={COLORS.palette} />
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="flex flex-col gap-3 flex-1">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: i === 0 ? COLORS.roll : COLORS.palette }} />
                        <span className="text-zinc-400 text-sm flex-1">{d.name}</span>
                        <span className="text-white font-bold text-sm tabular-nums">{d.value}</span>
                        <span className="text-zinc-600 text-xs w-10 text-right">{d.pct}%</span>
                      </div>
                    ))}
                    <p className="text-xs text-zinc-600">Total : {total} missions</p>
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
