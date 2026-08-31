import { AXES } from '../game/constants'
import { formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'
import { Monogram } from './icons'

export function AxesPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  return (
    <div>
      <p className="hint">
        Les axes montent seulement au Redoublement : à chaque redoublement, tu choisis lequel booster.
        Pas d'achat, pas de monnaie à gérer.
      </p>
      <ul className="axis-list">
        {AXES.map((def) => {
          const mult = engine.state.axisMultipliers[def.id]

          return (
            <li key={def.id} className="axis-card">
              <div className="axis-info">
                <Monogram label={def.name} />
                <div>
                  <div className="axis-name">
                    {def.name} <span className="axis-level">x{formatNumber(mult)}</span>
                  </div>
                  <div className="axis-desc">{def.description}</div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
