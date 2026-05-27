'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  color?: 'green' | 'amber' | 'red' | 'blue' | 'gray'
  size?: 'sm' | 'lg'
}

const valueColors = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red:   'text-red-400',
  blue:  'text-blue-400',
  gray:  'text-zinc-400',
}

const topBorderColors = {
  green: 'border-t-emerald-500/50',
  amber: 'border-t-amber-500/50',
  red:   'border-t-red-500/50',
  blue:  'border-t-blue-500/50',
  gray:  'border-t-zinc-700/60',
}

export function StatCard({ label, value, sublabel, color = 'gray', size = 'sm' }: StatCardProps) {
  return (
    <div className={cn(
      'bg-zinc-900 rounded-2xl p-4 border border-white/[0.06] border-t-2 flex flex-col gap-1.5',
      topBorderColors[color]
    )}>
      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest leading-none">{label}</span>
      <span className={cn(
        'font-bold tabular-nums leading-none',
        size === 'lg' ? 'text-5xl' : 'text-3xl',
        valueColors[color]
      )}>
        {value}
      </span>
      {sublabel && <span className="text-[11px] text-zinc-600 leading-none">{sublabel}</span>}
    </div>
  )
}
