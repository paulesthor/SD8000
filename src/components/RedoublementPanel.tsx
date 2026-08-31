import { AXES } from '../game/constants'
import { formatMultiplier, formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'

export function RedoublementPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const gain = engine.previewMultiplierGain
  const canRedouble = gain > 0

  return (
    <div className="redoublement-panel">
      <p className="hint">
        Redoubler remet ta puanteur et tes générateurs à zéro, mais te donne un multiplicateur à
        appliquer sur l'axe de ton choix. Atteindre tout juste le seuil minimum ne rapporte rien —
        c'est ce que tu accumules <em>au-delà</em> qui compte, donc redoubler dès que possible en
        boucle ne sert à rien : mieux vaut laisser tourner un peu.
      </p>

      <div className="redoublement-stat">
        <span>Puanteur accumulée ce cycle</span>
        <strong>
          {formatNumber(engine.state.earnedSinceReset)} / {formatNumber(engine.currentThreshold)} min.
        </strong>
      </div>
      <div className="redoublement-stat">
        <span>Gain si tu redoubles maintenant</span>
        <strong>{canRedouble ? `+${formatNumber(gain * 100)}%` : '—'}</strong>
      </div>

      {!canRedouble && (
        <p className="hint">
          Continue d'accumuler : il faut dépasser le seuil minimum ({formatNumber(engine.currentThreshold)}
          ) pour qu'un redoublement rapporte quoi que ce soit.
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
                    x{formatMultiplier(current)} → x{formatMultiplier(next)}
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
