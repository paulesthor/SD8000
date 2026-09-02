import { AXES } from '../game/constants'
import { formatMultiplier, formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'

export function RedoublementPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const canRedouble = engine.previewMultiplierGain > 0
  const couche2Progress = Math.min(1, engine.state.bestCycleEarned / engine.couche2Threshold)

  return (
    <div className="redoublement-panel">
      <div className="couche2-banner">
        <div className="couche2-banner-row">
          <span>Passage d'année</span>
          <strong>{engine.couche2Unlocked ? 'Débloqué' : `${(couche2Progress * 100).toFixed(1)}%`}</strong>
        </div>
        <div className="couche2-bar">
          <div className="couche2-bar-fill" style={{ width: `${couche2Progress * 100}%` }} />
        </div>
        <p className="hint">
          {engine.couche2Unlocked
            ? "Ton meilleur cycle est assez fort pour changer d'année — cette couche arrive bientôt."
            : `Meilleur cycle atteint : ${formatNumber(engine.state.bestCycleEarned)} / ${formatNumber(engine.couche2Threshold)}`}
        </p>
      </div>

      <p className="hint">
        Redoubler remet ta puanteur et tes générateurs à zéro, mais te donne un multiplicateur à
        appliquer sur l'axe de ton choix. Chaque axe a son propre seuil : réinvestir dans un axe
        déjà bien développé demande d'atteindre au moins autant de puanteur que la dernière fois
        où tu l'as choisi — un axe jamais touché reste au seuil normal, moins cher.
      </p>

      <div className="redoublement-stat">
        <span>Puanteur accumulée ce cycle</span>
        <strong>
          {formatNumber(engine.state.earnedSinceReset)} / {formatNumber(engine.currentThreshold)} (seuil
          minimum)
        </strong>
      </div>

      {!canRedouble && (
        <p className="hint">
          Continue d'accumuler : il faut dépasser le seuil minimum ({formatNumber(engine.currentThreshold)}
          ) pour qu'un redoublement rapporte quoi que ce soit — et davantage pour un axe déjà
          développé.
        </p>
      )}

      <ul className="axis-choice-list">
        {AXES.map((def) => {
          const current = engine.state.axisMultipliers[def.id]
          const { threshold, gain } = engine.axisRedoublementInfo[def.id]
          const locked = gain <= 0
          const next = current * (1 + gain)
          const boosted = engine.state.axisFloors[def.id] > 0

          return (
            <li key={def.id}>
              <button className="axis-choice-button" disabled={locked} onClick={() => engine.redoubler(def.id)}>
                <span className="axis-choice-info">
                  <span className="axis-choice-name">{def.name}</span>
                  {locked ? (
                    <span className="axis-choice-locked">
                      {boosted ? 'Déjà développé — ' : ''}besoin de {formatNumber(threshold)} ce cycle
                    </span>
                  ) : (
                    <span className="axis-choice-values">
                      x{formatMultiplier(current)} → x{formatMultiplier(next)} (+{formatNumber(gain * 100)}%)
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
