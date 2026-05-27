'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface BigButtonProps {
  label: string
  sublabel?: string
  icon?: LucideIcon
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'ghost'
  size?: 'md' | 'lg'
  loading?: boolean
  className?: string
}

const variants = {
  primary:  'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border border-blue-500/30',
  success:  'bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white border border-emerald-600/30',
  warning:  'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border border-amber-500/30',
  danger:   'bg-red-700 hover:bg-red-600 active:bg-red-800 text-white border border-red-600/30',
  ghost:    'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-zinc-100 border border-zinc-700',
}

export function BigButton({
  label,
  sublabel,
  icon: Icon,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
}: BigButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-xl font-semibold transition-colors select-none',
        size === 'lg' ? 'min-h-[80px] px-6 py-4 text-xl' : 'min-h-[64px] px-4 py-3 text-base',
        variants[variant],
        (disabled || loading) && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {Icon && <Icon size={size === 'lg' ? 28 : 22} strokeWidth={2} />}
      <span>{loading ? '…' : label}</span>
      {sublabel && <span className="text-xs font-normal opacity-70">{sublabel}</span>}
    </button>
  )
}
