'use client'

interface TopBarProps {
  title: string
  right?: React.ReactNode
}

export function TopBar({ title, right }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3.5 flex items-center justify-between">
      <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
      {right && <div>{right}</div>}
    </header>
  )
}
