import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUTOSAVE_INTERVAL_MS, COUCHE_2_UNLOCK_THRESHOLD, TICK_MS } from './constants'
import {
  applyAxisGain,
  applyElapsedProduction,
  ascensionThreshold,
  computeMultipliers,
  createInitialState,
  generatorCost,
  isCouche2Unlocked,
  maxAffordable,
  productionPerSecond,
  redoublementMultiplierGain,
  redoublementThreshold,
} from './engine'
import { loadState, saveState } from './save'
import type { AxisId, GameState, GeneratorId } from './types'

export interface OfflineReport {
  seconds: number
  puanteurGained: number
}

export function useGameEngine() {
  const [state, setState] = useState<GameState>(createInitialState)
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Guards the focus/pageshow catch-up below from firing before the saved state has loaded —
  // otherwise it computes a "catch-up" off the fresh default state and clobbers the real save.
  const loadedRef = useRef(false)

  // Load save + apply offline progress once on mount.
  useEffect(() => {
    const { state: loaded, offlineSeconds } = loadState()
    if (offlineSeconds > 5) {
      const { state: caughtUp, gained } = applyElapsedProduction(loaded, offlineSeconds)
      setOfflineReport({ seconds: offlineSeconds, puanteurGained: gained })
      setState(caughtUp)
    } else {
      loaded.lastTickAt = Date.now()
      setState(loaded)
    }
    loadedRef.current = true
  }, [])

  // Catch up whenever the app regains focus without a full reload — e.g. the phone was
  // locked, the browser/PWA tab was backgrounded, or bfcache restored the page. Mobile
  // browsers throttle or fully suspend setInterval while hidden, so the tick loop alone
  // can't be trusted to keep production going; this closes whatever gap it missed.
  useEffect(() => {
    const catchUp = () => {
      if (!loadedRef.current) return
      if (document.visibilityState !== 'visible') return
      const elapsedSeconds = (Date.now() - stateRef.current.lastTickAt) / 1000
      if (elapsedSeconds < 2) return
      const { state: caughtUp, gained } = applyElapsedProduction(stateRef.current, elapsedSeconds)
      setState(caughtUp)
      if (elapsedSeconds > 5) {
        setOfflineReport({ seconds: elapsedSeconds, puanteurGained: gained })
      }
    }
    document.addEventListener('visibilitychange', catchUp)
    window.addEventListener('pageshow', catchUp)
    window.addEventListener('focus', catchUp)
    return () => {
      document.removeEventListener('visibilitychange', catchUp)
      window.removeEventListener('pageshow', catchUp)
      window.removeEventListener('focus', catchUp)
    }
  }, [])

  // Game tick.
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const mult = computeMultipliers(prev.axisMultipliers, Math.random())
        const rate = productionPerSecond(prev.owned, prev.ascensionLevels, mult)
        const gained = rate * (TICK_MS / 1000)
        return {
          ...prev,
          puanteur: prev.puanteur + gained,
          earnedSinceReset: prev.earnedSinceReset + gained,
          lifetimeEarned: prev.lifetimeEarned + gained,
          lastTickAt: Date.now(),
        }
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Autosave.
  useEffect(() => {
    const id = setInterval(() => saveState(stateRef.current), AUTOSAVE_INTERVAL_MS)
    const onHide = () => saveState(stateRef.current)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [])

  const mult = useMemo(() => computeMultipliers(state.axisMultipliers, 0.5), [state.axisMultipliers])
  const rate = useMemo(
    () => productionPerSecond(state.owned, state.ascensionLevels, mult),
    [state.owned, state.ascensionLevels, mult],
  )

  const buyGenerator = useCallback((id: GeneratorId, mode: 1 | 10 | 'max') => {
    setState((prev) => {
      const owned = prev.owned[id]
      const ascLevel = prev.ascensionLevels[id]
      const costMult = computeMultipliers(prev.axisMultipliers).costMult
      if (mode === 'max') {
        const { qty, cost } = maxAffordable(id, owned, prev.puanteur, costMult, ascLevel)
        if (qty === 0) return prev
        return { ...prev, puanteur: prev.puanteur - cost, owned: { ...prev.owned, [id]: owned + qty } }
      }
      const cost = generatorCost(id, owned, mode, costMult, ascLevel)
      if (cost > prev.puanteur) return prev
      return { ...prev, puanteur: prev.puanteur - cost, owned: { ...prev.owned, [id]: owned + mode } }
    })
  }, [])

  const ascendGenerator = useCallback((id: GeneratorId) => {
    setState((prev) => {
      const owned = prev.owned[id]
      const level = prev.ascensionLevels[id]
      if (owned < ascensionThreshold(level)) return prev
      return {
        ...prev,
        owned: { ...prev.owned, [id]: 0 },
        ascensionLevels: { ...prev.ascensionLevels, [id]: level + 1 },
      }
    })
  }, [])

  const previewMultiplierGain = useMemo(
    () => redoublementMultiplierGain(state.earnedSinceReset, state.redoublements),
    [state.earnedSinceReset, state.redoublements],
  )

  /** Redoubles and applies this redoublement's multiplier gain to the chosen axis. */
  const redoubler = useCallback((axisId: AxisId) => {
    setState((prev) => {
      const gain = redoublementMultiplierGain(prev.earnedSinceReset, prev.redoublements)
      if (gain <= 0) return prev
      const fresh = createInitialState()
      return {
        ...fresh,
        lifetimeEarned: prev.lifetimeEarned,
        ascensionLevels: prev.ascensionLevels,
        axisMultipliers: {
          ...prev.axisMultipliers,
          [axisId]: applyAxisGain(prev.axisMultipliers[axisId], gain),
        },
        redoublements: prev.redoublements + 1,
      }
    })
  }, [])

  const currentThreshold = useMemo(
    () => redoublementThreshold(state.redoublements),
    [state.redoublements],
  )

  const couche2Unlocked = useMemo(() => isCouche2Unlocked(state.lifetimeEarned), [state.lifetimeEarned])

  return {
    state,
    multipliers: mult,
    productionRate: rate,
    previewMultiplierGain,
    currentThreshold,
    couche2Unlocked,
    couche2Threshold: COUCHE_2_UNLOCK_THRESHOLD,
    buyGenerator,
    ascendGenerator,
    redoubler,
    offlineReport,
    dismissOfflineReport: () => setOfflineReport(null),
  }
}
