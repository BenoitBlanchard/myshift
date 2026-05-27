'use client'

interface TopBarProps {
  title: string
  right?: React.ReactNode
}

export function TopBar({ title, right }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      {right && <div>{right}</div>}
    </header>
  )
}
