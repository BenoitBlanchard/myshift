'use client'

import { cn } from '@/lib/utils'

interface PinInputProps {
  value: string
  onChange: (val: string) => void
  maxLength?: number
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export function PinInput({ value, onChange, maxLength = 4 }: PinInputProps) {
  function press(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (key && value.length < maxLength) {
      onChange(value + key)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all',
              i < value.length
                ? 'border-blue-500 bg-blue-950/40 text-white'
                : 'border-zinc-700 bg-zinc-900 text-zinc-700'
            )}
          >
            {i < value.length ? '●' : ''}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => key && press(key)}
            disabled={!key}
            className={cn(
              'h-14 w-14 rounded-xl text-xl font-semibold transition-colors select-none',
              key === '⌫'
                ? 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 border border-zinc-700'
                : key
                ? 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white border border-zinc-800'
                : 'invisible'
            )}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
