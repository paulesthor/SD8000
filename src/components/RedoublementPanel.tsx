import { AXES } from '../game/constants'
import { formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'

export function RedoublementPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const gain = engine.previewMultiplierGain
  const canRedouble = gain > 0

  return (
    <div className="redoublement-panel">
      <p className="hint">
        Redoubler remet ta puanteur et tes générateurs à zéro, mais te donne un multiplicateur —
        plus tu as accumulé de puanteur, plus il est gros — à appliquer sur l'axe de ton choix.
        Pas de monnaie à gérer : le choix se fait au moment de redoubler.
      </p>

      <div className="redoublement-stat">
        <span>Puanteur accumulée ce cycle</span>
        <strong>
          {formatNumber(engine.state.earnedSinceReset)} / {formatNumber(engine.currentThreshold)}
        </strong>
      </div>
      <div className="redoublement-stat">
        <span>Gain si tu redoubles maintenant</span>
        <strong>{canRedouble ? `+${formatNumber(gain * 100)}%` : '—'}</strong>
      </div>

      {!canRedouble && (
        <p className="hint">
          Accumule encore de la puanteur avant de pouvoir redoubler (seuil du prochain
          redoublement : {formatNumber(engine.currentThreshold)}).
        </p>
      )}

      {canRedouble && (
        <ul className="axis-choice-list">
          {AXES.map((def) => {
            const current = engine.state.axisMultipliers[def.id]
            const next = current * (1 + gain)
            return (
              <li key={def.id}>
                <button className="axis-choice-button" onClick={() => engine.redoubler(def.id)}>
                  <span className="axis-choice-name">{def.name}</span>
                  <span className="axis-choice-values">
                    x{formatNumber(current)} → x{formatNumber(next)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
