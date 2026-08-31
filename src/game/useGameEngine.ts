import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUTOSAVE_INTERVAL_MS, TICK_MS } from './constants'
import {
  ascensionThreshold,
  axisCost,
  computeMultipliers,
  createInitialState,
  generatorCost,
  maxAffordable,
  prForRedoublement,
  productionPerSecond,
  redoublementGlobalMult,
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

  // Load save + apply offline progress once on mount.
  useEffect(() => {
    const { state: loaded, offlineSeconds } = loadState()
    if (offlineSeconds > 5) {
      const mult = computeMultipliers(loaded.axisLevels, 0.5)
      const rate =
        productionPerSecond(loaded.owned, loaded.ascensionLevels, mult) *
        redoublementGlobalMult(loaded.redoublements)
      const gained = rate * offlineSeconds
      loaded.puanteur += gained
      loaded.earnedSinceReset += gained
      setOfflineReport({ seconds: offlineSeconds, puanteurGained: gained })
    }
    loaded.lastTickAt = Date.now()
    setState(loaded)
  }, [])

  // Game tick.
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const mult = computeMultipliers(prev.axisLevels, Math.random())
        const rate =
          productionPerSecond(prev.owned, prev.ascensionLevels, mult) *
          redoublementGlobalMult(prev.redoublements)
        const gained = rate * (TICK_MS / 1000)
        return {
          ...prev,
          puanteur: prev.puanteur + gained,
          earnedSinceReset: prev.earnedSinceReset + gained,
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

  const mult = useMemo(() => computeMultipliers(state.axisLevels, 0.5), [state.axisLevels])
  const rate = useMemo(
    () =>
      productionPerSecond(state.owned, state.ascensionLevels, mult) *
      redoublementGlobalMult(state.redoublements),
    [state.owned, state.ascensionLevels, mult, state.redoublements],
  )

  const buyGenerator = useCallback((id: GeneratorId, mode: 1 | 10 | 'max') => {
    setState((prev) => {
      const owned = prev.owned[id]
      const ascLevel = prev.ascensionLevels[id]
      const costMult = computeMultipliers(prev.axisLevels).costMult
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

  const buyAxis = useCallback((id: AxisId) => {
    setState((prev) => {
      const level = prev.axisLevels[id]
      const cost = axisCost(id, level)
      if (cost > prev.pr) return prev
      return { ...prev, pr: prev.pr - cost, axisLevels: { ...prev.axisLevels, [id]: level + 1 } }
    })
  }, [])

  const previewPr = useMemo(() => prForRedoublement(state.earnedSinceReset), [state.earnedSinceReset])

  const redoubler = useCallback(() => {
    setState((prev) => {
      const gained = prForRedoublement(prev.earnedSinceReset)
      if (gained <= 0) return prev
      const fresh = createInitialState()
      return {
        ...fresh,
        pr: prev.pr + gained,
        axisLevels: prev.axisLevels,
        ascensionLevels: prev.ascensionLevels,
        redoublements: prev.redoublements + 1,
      }
    })
  }, [])

  return {
    state,
    multipliers: mult,
    productionRate: rate,
    previewPr,
    buyGenerator,
    ascendGenerator,
    buyAxis,
    redoubler,
    offlineReport,
    dismissOfflineReport: () => setOfflineReport(null),
  }
}
