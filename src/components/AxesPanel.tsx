import { AXES } from '../game/constants'
import { axisCost } from '../game/engine'
import { formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'
import { Monogram } from './icons'

export function AxesPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  return (
    <div>
      <p className="hint">
        Les axes sont achetés avec les Points de Redoublement (PR) et restent acquis d'un redoublement à
        l'autre.
      </p>
      <ul className="axis-list">
        {AXES.map((def) => {
          const level = engine.state.axisLevels[def.id]
          const cost = axisCost(def.id, level)
          const affordable = cost <= engine.state.pr

          return (
            <li key={def.id} className="axis-card">
              <div className="axis-info">
                <Monogram label={def.name} />
                <div>
                  <div className="axis-name">
                    {def.name} <span className="axis-level">niv. {level}</span>
                  </div>
                  <div className="axis-desc">{def.description}</div>
                </div>
              </div>
              <button disabled={!affordable} onClick={() => engine.buyAxis(def.id)}>
                Améliorer
                <span className="cost">{formatNumber(cost)} PR</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
