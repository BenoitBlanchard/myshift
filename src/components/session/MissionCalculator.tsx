'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type Op = '+' | '−' | '×' | '÷' | null

interface MissionCalculatorProps {
  currentNote: string | null
  onSave: (note: string) => void
  onClose: () => void
}

function applyOp(a: number, op: Op, b: number): number {
  if (op === '+') return a + b
  if (op === '−') return a - b
  if (op === '×') return a * b
  if (op === '÷') return b !== 0 ? a / b : 0
  return b
}

function fmt(n: number): string {
  return parseFloat(n.toFixed(10)).toString().replace('.', ',')
}

export function MissionCalculator({ currentNote, onSave, onClose }: MissionCalculatorProps) {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [pendingOp, setPendingOp] = useState<Op>(null)
  const [operand, setOperand] = useState<number | null>(null)
  const [fresh, setFresh] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [phase, setPhase] = useState<'calc' | 'confirm'>('calc')

  function pressDigit(d: string) {
    if (phase === 'confirm') return
    if (fresh) {
      setDisplay(d)
      setExpression(prev => prev + d)
      setFresh(false)
    } else {
      setDisplay(prev => prev === '0' ? d : prev + d)
      setExpression(prev => prev + d)
    }
  }

  function pressComma() {
    if (phase === 'confirm') return
    if (fresh) {
      setDisplay('0,')
      setExpression(prev => prev + '0,')
      setFresh(false)
      return
    }
    if (!display.includes(',')) {
      setDisplay(prev => prev + ',')
      setExpression(prev => prev + ',')
    }
  }

  function pressOp(op: Op) {
    if (phase === 'confirm') return
    const val = parseFloat(display.replace(',', '.'))
    if (pendingOp && operand !== null && !fresh) {
      const res = parseFloat(applyOp(operand, pendingOp, val).toFixed(10))
      setOperand(res)
      setDisplay(fmt(res))
      setExpression(fmt(res) + ' ' + op + ' ')
    } else {
      setOperand(val)
      setExpression((expression || fmt(val)) + ' ' + op + ' ')
    }
    setPendingOp(op)
    setFresh(true)
  }

  function pressEquals() {
    if (phase === 'confirm') return
    const val = parseFloat(display.replace(',', '.'))
    if (!pendingOp || operand === null) {
      // no operator — record the displayed value directly
      setResult(val)
      setExpression(display + ' = ' + fmt(val))
      setFresh(true)
      setPhase('confirm')
      return
    }
    const res = parseFloat(applyOp(operand, pendingOp, val).toFixed(10))
    setDisplay(fmt(res))
    setExpression(prev => prev + ' = ' + fmt(res))
    setPendingOp(null)
    setOperand(null)
    setFresh(true)
    setResult(res)
    setPhase('confirm')
  }

  function pressClear() {
    setDisplay('0')
    setExpression('')
    setPendingOp(null)
    setOperand(null)
    setFresh(false)
    setResult(null)
    setPhase('calc')
    setLabel('')
  }

  function pressBackspace() {
    if (phase === 'confirm') { pressClear(); return }
    if (fresh) { pressClear(); return }
    if (display.length <= 1) {
      setDisplay('0')
      setExpression(prev => prev.slice(0, -1))
    } else {
      setDisplay(prev => prev.slice(0, -1))
      setExpression(prev => prev.slice(0, -1))
    }
  }

  function handleSave() {
    if (result === null) return
    const suffix = label.trim() ? ` ${label.trim()}` : ''
    const line = `calcul : ${fmt(result)}${suffix}`
    const newNote = currentNote ? `${currentNote}\n${line}` : line
    onSave(newNote)
  }

  const num = (v: string) =>
    'h-[52px] rounded-2xl bg-zinc-800/80 text-white text-xl font-bold border border-white/[0.06] hover:bg-zinc-700/80 active:scale-[0.93] transition-all flex items-center justify-center'
  const op = () =>
    'h-[52px] rounded-2xl bg-zinc-700/50 text-amber-400 text-xl font-bold border border-white/[0.06] hover:bg-zinc-700/80 active:scale-[0.93] transition-all flex items-center justify-center'
  const eq = () =>
    'h-[52px] rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white text-xl font-bold border border-blue-400/20 shadow-[0_0_16px_rgba(59,130,246,0.3)] active:scale-[0.93] transition-all flex items-center justify-center'
  const fn = () =>
    'h-[52px] rounded-2xl bg-zinc-800/60 text-zinc-300 text-xl font-bold border border-white/[0.06] hover:bg-zinc-700/70 active:scale-[0.93] transition-all flex items-center justify-center'

  return (
    <Modal title="Calculette" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Affichage */}
        <div className="bg-zinc-950 rounded-2xl px-4 py-3 text-right border border-white/[0.05]">
          <p className="text-xs text-zinc-600 h-4 truncate leading-none">{expression || ' '}</p>
          <p className="text-4xl font-bold tabular-nums text-white mt-1 leading-tight">{display}</p>
        </div>

        {phase === 'confirm' && result !== null ? (
          <div className="flex flex-col gap-3">
            <div className="bg-zinc-900/60 rounded-2xl px-4 py-3 text-center border border-white/[0.06]">
              <p className="text-xs text-zinc-500 mb-1">Résultat</p>
              <p className="text-3xl font-bold text-white tabular-nums">{fmt(result)}</p>
            </div>

            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="de viandes, boissons… (optionnel)"
              autoFocus
              className="w-full bg-zinc-800/60 border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 placeholder:text-zinc-600"
            />

            <p className="text-xs text-zinc-600 text-center">
              Note : <span className="text-zinc-400 font-medium">
                &quot;calcul : {fmt(result)}{label.trim() ? ' ' + label.trim() : ''}&quot;
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                onClick={pressClear}
                className="py-3.5 rounded-2xl bg-zinc-800/60 text-zinc-300 font-semibold border border-white/[0.08] hover:bg-zinc-700/70 active:scale-[0.97] transition-all"
              >
                Recalculer
              </button>
              <button
                onClick={handleSave}
                className="py-3.5 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white font-semibold border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:from-blue-400 hover:to-blue-600 active:scale-[0.97] transition-all"
              >
                Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {/* Ligne 1 */}
            <button className={fn()} onClick={pressClear}>C</button>
            <button className={fn()} onClick={pressBackspace}>⌫</button>
            <button className={op()} onClick={() => pressOp('÷')}>÷</button>
            <button className={op()} onClick={() => pressOp('×')}>×</button>
            {/* Ligne 2 */}
            <button className={num('')} onClick={() => pressDigit('7')}>7</button>
            <button className={num('')} onClick={() => pressDigit('8')}>8</button>
            <button className={num('')} onClick={() => pressDigit('9')}>9</button>
            <button className={op()} onClick={() => pressOp('−')}>−</button>
            {/* Ligne 3 */}
            <button className={num('')} onClick={() => pressDigit('4')}>4</button>
            <button className={num('')} onClick={() => pressDigit('5')}>5</button>
            <button className={num('')} onClick={() => pressDigit('6')}>6</button>
            <button className={op()} onClick={() => pressOp('+')}>+</button>
            {/* Ligne 4 */}
            <button className={num('')} onClick={() => pressDigit('1')}>1</button>
            <button className={num('')} onClick={() => pressDigit('2')}>2</button>
            <button className={num('')} onClick={() => pressDigit('3')}>3</button>
            <button className={`${eq()} row-span-2`} onClick={pressEquals}>=</button>
            {/* Ligne 5 */}
            <button className={`${num('')} col-span-2`} onClick={() => pressDigit('0')}>0</button>
            <button className={num('')} onClick={pressComma}>,</button>
          </div>
        )}
      </div>
    </Modal>
  )
}
