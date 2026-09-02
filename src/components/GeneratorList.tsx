import { GENERATORS } from '../game/constants'
import {
  canAscendItem,
  dimensionTierMultiplier,
  generatorCost,
  generatorProductionPerSecond,
  itemAscensionCap,
  itemAscensionMultiplier,
  maxAffordable,
} from '../game/engine'
import { formatMultiplier, formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'
import { Monogram } from './icons'

export function GeneratorList({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const costMult = engine.multipliers.costMult

  const canBuyOrAscendAny = GENERATORS.some((def) => {
    const owned = engine.state.owned[def.id]
    const ascLevel = engine.state.ascensionLevels[def.id]
    if (canAscendItem(owned, ascLevel)) return true
    return maxAffordable(def.id, owned, engine.state.puanteur, costMult, ascLevel).qty > 0
  })

  return (
    <>
      <button className="buy-max-all-button" disabled={!canBuyOrAscendAny} onClick={engine.buyAndAscendAll}>
        Tout acheter au max + redémarrer
      </button>
      <ul className="generator-list">
      {GENERATORS.map((def, index) => {
        const owned = engine.state.owned[def.id]
        const ascLevel = engine.state.ascensionLevels[def.id]

        const cost1 = generatorCost(def.id, owned, 1, costMult, ascLevel)
        const { qty: maxQty, cost: maxCost } = maxAffordable(def.id, owned, engine.state.puanteur, costMult, ascLevel)
        const produced = generatorProductionPerSecond(index, engine.state.owned, engine.state.ascensionLevels, engine.multipliers)
        const target = index === 0 ? 'puanteur' : GENERATORS[index - 1].name

        const dimMult = dimensionTierMultiplier(owned)
        const ascMult = itemAscensionMultiplier(ascLevel)
        const ascCap = itemAscensionCap(ascLevel)
        const canAscend = canAscendItem(owned, ascLevel)
        const nextAscMult = itemAscensionMultiplier(ascLevel + 1)

        return (
          <li key={def.id} className="generator-card">
            <div className="generator-info">
              <Monogram label={def.name} />
              <div>
                <div className="generator-name">
                  {def.name}
                  {dimMult > 1 && <span className="asc-badge">x{formatMultiplier(dimMult)} palier</span>}
                </div>
                <div className="generator-meta">
                  Nv.{formatNumber(Math.floor(owned))} · produit {formatNumber(produced)} {target}/s
                  {ascMult > 1 && <span className="tier-boost"> · x{formatMultiplier(ascMult)} ascension</span>}
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
              <button disabled={!canAscend} onClick={() => engine.ascendItem(def.id)}>
                Redémarrer
                <span className="cost">
                  {canAscend
                    ? `→ x${formatMultiplier(nextAscMult)}`
                    : `${formatNumber(Math.floor(owned))}/${formatNumber(Math.floor(ascCap))}`}
                </span>
              </button>
              <button disabled={maxQty === 0} onClick={() => engine.buyGenerator(def.id, 'max')}>
                MAX{maxQty > 0 ? ` (${maxQty})` : ''}
                <span className="cost">{formatNumber(maxCost)}</span>
              </button>
            </div>
          </li>
        )
      })}
      </ul>
    </>
  )
}
