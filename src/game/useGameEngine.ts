import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUTOSAVE_INTERVAL_MS, AXES, COUCHE_2_UNLOCK_THRESHOLD, TICK_MS } from './constants'
import {
  applyAxisGain,
  applyElapsedProduction,
  axisRedoublementThreshold,
  cadenceCost,
  computeMultipliers,
  createInitialState,
  generatorCost,
  grandMenageCost,
  isCouche2Unlocked,
  itemAscensionCap,
  maxAffordable,
  maxAffordableCadenceLevels,
  performAscendItem,
  performBuyCadence,
  performBuyCadenceMax,
  performGrandMenage,
  productionPerSecond,
  redoublementMultiplierGain,
  redoublementThreshold,
} from './engine'
import { loadState, resetSave, saveState } from './save'
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
        const mult = computeMultipliers(prev.axisMultipliers, prev.cadenceLevel, Math.random())
        const rate = productionPerSecond(prev.owned, prev.ascensionLevels, mult)
        const gained = rate * (TICK_MS / 1000)
        const earnedSinceReset = prev.earnedSinceReset + gained
        return {
          ...prev,
          puanteur: prev.puanteur + gained,
          earnedSinceReset,
          bestCycleEarned: Math.max(prev.bestCycleEarned, earnedSinceReset),
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

  const mult = useMemo(
    () => computeMultipliers(state.axisMultipliers, state.cadenceLevel, 0.5),
    [state.axisMultipliers, state.cadenceLevel],
  )
  const rate = useMemo(
    () => productionPerSecond(state.owned, state.ascensionLevels, mult),
    [state.owned, state.ascensionLevels, mult],
  )

  const buyGenerator = useCallback((id: GeneratorId, mode: 1 | 'max') => {
    setState((prev) => {
      const owned = prev.owned[id]
      const ascLevel = prev.ascensionLevels[id]
      const costMult = computeMultipliers(prev.axisMultipliers, prev.cadenceLevel).costMult
      if (mode === 'max') {
        const { qty, cost } = maxAffordable(id, owned, prev.puanteur, costMult, ascLevel)
        if (qty === 0) return prev
        return { ...prev, puanteur: prev.puanteur - cost, owned: { ...prev.owned, [id]: owned + qty } }
      }
      if (owned >= itemAscensionCap(ascLevel)) return prev
      const cost = generatorCost(id, owned, mode, costMult, ascLevel)
      if (cost > prev.puanteur) return prev
      return { ...prev, puanteur: prev.puanteur - cost, owned: { ...prev.owned, [id]: owned + mode } }
    })
  }, [])

  const ascendItem = useCallback((id: GeneratorId) => {
    setState((prev) => performAscendItem(prev, id))
  }, [])

  const buyGrandMenage = useCallback(() => {
    setState((prev) => performGrandMenage(prev))
  }, [])

  const buyCadence = useCallback(() => {
    setState((prev) => performBuyCadence(prev))
  }, [])

  const buyCadenceMax = useCallback(() => {
    setState((prev) => performBuyCadenceMax(prev))
  }, [])

  /**
   * Resets in-memory state directly instead of clearing storage + reloading the page: a reload
   * fires `beforeunload`, which the autosave effect below listens for to save on the way out —
   * that re-wrote the just-cleared save with the stale pre-reset state before the reload could
   * even take effect, so "Réinitialiser" silently did nothing.
   */
  const resetGame = useCallback(() => {
    resetSave()
    setOfflineReport(null)
    setState(createInitialState())
  }, [])

  /** Per-axis: what redoubling into that axis right now would cost (threshold) and yield (gain). */
  const axisRedoublementInfo = useMemo(() => {
    const info = {} as Record<AxisId, { threshold: number; gain: number }>
    for (const def of AXES) {
      const threshold = axisRedoublementThreshold(state.redoublements, state.axisFloors[def.id])
      info[def.id] = { threshold, gain: redoublementMultiplierGain(state.earnedSinceReset, threshold) }
    }
    return info
  }, [state.redoublements, state.axisFloors, state.earnedSinceReset])

  // Best gain across axes — used as a general "is redoubling worth anything at all right now"
  // signal (e.g. to show/hide the axis-choice list), not as the gain any specific axis gets.
  const previewMultiplierGain = useMemo(
    () => Math.max(0, ...AXES.map((def) => axisRedoublementInfo[def.id].gain)),
    [axisRedoublementInfo],
  )

  /** Redoubles and applies this redoublement's multiplier gain to the chosen axis. */
  const redoubler = useCallback(
    (axisId: AxisId) => {
      setState((prev) => {
        const threshold = axisRedoublementThreshold(prev.redoublements, prev.axisFloors[axisId])
        const gain = redoublementMultiplierGain(prev.earnedSinceReset, threshold)
        if (gain <= 0) return prev
        const fresh = createInitialState()
        return {
          ...fresh,
          bestCycleEarned: prev.bestCycleEarned,
          axisMultipliers: {
            ...prev.axisMultipliers,
            [axisId]: applyAxisGain(prev.axisMultipliers[axisId], gain),
          },
          axisFloors: { ...prev.axisFloors, [axisId]: prev.earnedSinceReset },
          redoublements: prev.redoublements + 1,
        }
      })
    },
    [],
  )

  const currentThreshold = useMemo(
    () => redoublementThreshold(state.redoublements),
    [state.redoublements],
  )

  const couche2Unlocked = useMemo(() => isCouche2Unlocked(state.bestCycleEarned), [state.bestCycleEarned])

  const grandMenageCostNow = grandMenageCost(state.grandsMenages)
  const cadenceCostNow = cadenceCost(state.cadenceLevel, state.grandsMenages)
  const cadenceMaxAffordable = useMemo(
    () => maxAffordableCadenceLevels(state.cadenceLevel, state.grandsMenages, state.puanteur),
    [state.cadenceLevel, state.grandsMenages, state.puanteur],
  )

  return {
    state,
    multipliers: mult,
    productionRate: rate,
    previewMultiplierGain,
    axisRedoublementInfo,
    currentThreshold,
    couche2Unlocked,
    couche2Threshold: COUCHE_2_UNLOCK_THRESHOLD,
    buyGenerator,
    ascendItem,
    buyGrandMenage,
    buyCadence,
    buyCadenceMax,
    grandMenageCostNow,
    cadenceCostNow,
    cadenceMaxAffordable,
    redoubler,
    resetGame,
    offlineReport,
    dismissOfflineReport: () => setOfflineReport(null),
  }
}
