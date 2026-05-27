'use client'

import { ProductivityStats } from '@/types'
import { StatCard } from './StatCard'
import { formatDeadTime, formatLph, formatTime } from '@/lib/productivity'

interface StatsGridProps {
  stats: ProductivityStats | null
  isLive?: boolean
}

function lphColor(lph: number | null, target: number): 'green' | 'amber' | 'red' | 'gray' {
  if (lph === null) return 'gray'
  const r = lph / target
  if (r >= 1.05) return 'green'
  if (r >= 0.95) return 'amber'
  return 'red'
}

const textColors = {
  green: 'text-emerald-400',
  red:   'text-red-400',
  amber: 'text-amber-400',
  blue:  'text-blue-400',
  gray:  'text-zinc-500',
}

function MiniCard({
  label,
  value,
  sub,
  color = 'gray',
  border,
}: {
  label: string
  value: string
  sub?: string
  color?: keyof typeof textColors
  border?: string
}) {
  return (
    <div className={`bg-zinc-900 rounded-xl px-3 py-2 border flex flex-col gap-0.5 ${border ?? 'border-zinc-800'}`}>
      <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-widest leading-none">{label}</span>
      <span className={`text-xl font-bold tabular-nums leading-tight ${textColors[color]}`}>{value}</span>
      {sub && <span className="text-[9px] text-zinc-600 leading-none">{sub}</span>}
    </div>
  )
}

export function StatsGrid({ stats, isLive }: StatsGridProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['Pad', 'Théorique', 'Réel', 'Objectif'].map(label => (
          <StatCard key={label} label={label} value="—" color="gray" />
        ))}
      </div>
    )
  }

  const {
    pad, theoretical, real, targetLph,
    diffLph, diffLinesTotal,
    projectedEndTime, projectedRemainingLines,
    totalFinalLines,
    currentDeadTimeMs, totalDeadTimeMs,
  } = stats

  const missionActive = projectedRemainingLines !== null

  // Avance/retard exprimé en temps
  const cushionPositive = (diffLinesTotal ?? 0) >= 0
  const cushionMs = diffLinesTotal !== null
    ? Math.abs(diffLinesTotal / targetLph) * 3600 * 1000
    : null

  if (!totalFinalLines) {
    return (
      <div className="flex flex-col gap-3">
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">En direct</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <MiniCard
            label="Temps mort"
            value={currentDeadTimeMs !== null ? formatDeadTime(currentDeadTimeMs) : '—'}
            sub={totalDeadTimeMs !== null ? `Total : ${formatDeadTime(totalDeadTimeMs)}` : undefined}
            color="amber"
            border={missionActive ? 'border-zinc-800' : 'border-amber-900/40'}
          />
          {projectedEndTime && (
            <MiniCard
              label="Fin mission"
              value={formatTime(projectedEndTime)}
              sub={projectedRemainingLines != null ? `~${projectedRemainingLines} lignes` : undefined}
              color="blue"
            />
          )}
        </div>
      </div>
    )
  }

  const diffSign = (diffLph ?? 0) >= 0 ? '+' : ''
  const linesSign = (diffLinesTotal ?? 0) >= 0 ? '+' : ''

  return (
    <div className="flex flex-col gap-3">
      {isLive && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">En direct</span>
        </div>
      )}

      {/* 3 métriques LPH */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Pad"       value={formatLph(pad)}         sublabel="l/h" color={lphColor(pad, targetLph)} />
        <StatCard label="Théorique" value={formatLph(theoretical)} sublabel="l/h" color={lphColor(theoretical, targetLph)} />
        <StatCard label="Réel"      value={formatLph(real)}        sublabel="l/h" color={lphColor(real, targetLph)} />
      </div>

      {/* Ligne 2 — Avance/Retard · Fin mission · Temps mort (même taille que ligne 1) */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label={cushionPositive ? 'Avance' : 'Retard'}
          value={cushionMs !== null ? `${cushionPositive ? '+' : '−'}${formatDeadTime(cushionMs)}` : '—'}
          color={cushionMs === null ? 'gray' : cushionPositive ? 'green' : 'red'}
        />
        <StatCard
          label="Fin mission"
          value={formatTime(projectedEndTime)}
          sublabel={projectedRemainingLines != null ? `~${projectedRemainingLines} lignes` : undefined}
          color="blue"
        />
        <StatCard
          label="Temps mort"
          value={currentDeadTimeMs !== null ? formatDeadTime(currentDeadTimeMs) : '—'}
          sublabel={totalDeadTimeMs !== null ? `Total : ${formatDeadTime(totalDeadTimeMs)}` : undefined}
          color="amber"
        />
      </div>

      {/* Ligne 3 — Écart l/h · Lignes */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Écart"
          value={diffLph !== null ? `${diffSign}${formatLph(diffLph)}` : '—'}
          sublabel="l/h vs objectif"
          color={diffLph === null ? 'gray' : diffLph >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Lignes"
          value={diffLinesTotal !== null ? `${linesSign}${diffLinesTotal}` : '—'}
          sublabel="vs objectif"
          color={diffLinesTotal === null ? 'gray' : diffLinesTotal >= 0 ? 'green' : 'red'}
        />
      </div>
    </div>
  )
}
