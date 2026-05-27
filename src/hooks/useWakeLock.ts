import { useEffect, useRef } from 'react'

export function useWakeLock(enabled: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null)

  async function acquire() {
    if (!enabled) return
    if (!('wakeLock' in navigator)) return
    try {
      sentinel.current = await navigator.wakeLock.request('screen')
    } catch {
      // Permission refusée ou navigateur non supporté — silencieux
    }
  }

  async function release() {
    if (sentinel.current) {
      await sentinel.current.release().catch(() => {})
      sentinel.current = null
    }
  }

  useEffect(() => {
    if (!enabled) {
      release()
      return
    }

    acquire()

    // Le wake lock est libéré automatiquement quand la page passe en arrière-plan.
    // On le réacquiert dès que la page redevient visible.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquire()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [enabled])
}
