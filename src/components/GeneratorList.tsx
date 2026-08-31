import { GENERATORS } from '../game/constants'
import {
  ascensionMultiplier,
  ascensionThreshold,
  generatorCost,
  generatorProductionPerSecond,
  maxAffordable,
  tierBoostMultiplier,
} from '../game/engine'
import { formatMultiplier, formatNumber, formatRate } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'
import { Monogram } from './icons'

export function GeneratorList({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const costMult = engine.multipliers.costMult

  return (
    <ul className="generator-list">
      {GENERATORS.map((def, index) => {
        const owned = engine.state.owned[def.id]
        const ascLevel = engine.state.ascensionLevels[def.id]
        const threshold = ascensionThreshold(ascLevel)
        const canAscend = owned >= threshold

        const cost1 = generatorCost(def.id, owned, 1, costMult, ascLevel)
        const cost10 = generatorCost(def.id, owned, 10, costMult, ascLevel)
        const { qty: maxQty, cost: maxCost } = maxAffordable(
          def.id,
          owned,
          engine.state.puanteur,
          costMult,
          ascLevel,
        )
        const rate = generatorProductionPerSecond(index, engine.state.owned, engine.state.ascensionLevels, engine.multipliers)

        const above = GENERATORS[index + 1]
        const boost = above ? tierBoostMultiplier(engine.state.owned[above.id]) : null

        return (
          <li key={def.id} className="generator-card">
            <div className="generator-info">
              <Monogram label={def.name} />
              <div>
                <div className="generator-name">
                  {def.name}
                  {ascLevel > 0 && <span className="asc-badge">asc. {ascLevel}</span>}
                </div>
                <div className="generator-meta">
                  x{owned} · {formatRate(rate)}
                  {boost && boost > 1 && (
                    <span className="tier-boost"> · boosté x{formatMultiplier(boost)} par {above!.name}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="generator-buttons">
              <button
                disabled={cost1 > engine.state.puanteur}
                onClick={() => engine.buyGenerator(def.id, 1)}
              >
                +1<span className="cost">{formatNumber(cost1)}</span>
              </button>
              <button
                disabled={cost10 > engine.state.puanteur}
                onClick={() => engine.buyGenerator(def.id, 10)}
              >
                +10<span className="cost">{formatNumber(cost10)}</span>
              </button>
              <button disabled={maxQty === 0} onClick={() => engine.buyGenerator(def.id, 'max')}>
                MAX{maxQty > 0 ? ` (${maxQty})` : ''}
                <span className="cost">{formatNumber(maxCost)}</span>
              </button>
            </div>
            <button
              className="ascend-button"
              disabled={!canAscend}
              onClick={() => engine.ascendGenerator(def.id)}
            >
              Ascension ({owned}/{threshold}) — passe à x{formatMultiplier(ascensionMultiplier(ascLevel + 1))}
              /unité
            </button>
          </li>
        )
      })}
    </ul>
  )
}
