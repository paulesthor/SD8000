import { canAscendItem } from '../game/engine'
import { GENERATORS } from '../game/constants'
import { formatMultiplier, formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'

/** Slim glance strip on the Générateurs tab — the state you'd otherwise have to switch tabs to check. */
export function QuickStats({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const redoublementProgress = Math.min(100, (engine.state.earnedSinceReset / engine.currentThreshold) * 100)
  const readyToAscend = GENERATORS.filter((def) => canAscendItem(engine.state.owned[def.id])).length

  return (
    <div className="quick-stats">
      <div className="qs-item">
        <span>Redoublement</span>
        <b>{redoublementProgress.toFixed(0)}% du seuil</b>
      </div>
      <div className="qs-item">
        <span>Cadence</span>
        <b>
          Nv.{engine.state.cadenceLevel} · x{formatMultiplier(engine.multipliers.cadenceMult)}
        </b>
      </div>
      <div className="qs-item">
        <span>Items prêts à redémarrer</span>
        <b>{readyToAscend}/8</b>
      </div>
      <div className="qs-item">
        <span>Grand ménage</span>
        <b>{formatNumber(engine.grandMenageCostNow)} Cave</b>
      </div>
    </div>
  )
}
