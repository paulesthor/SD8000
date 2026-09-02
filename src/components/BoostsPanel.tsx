import { LAST_GENERATOR_ID } from '../game/engine'
import { CADENCE_EFFECT_PER_LEVEL, GENERATORS } from '../game/constants'
import { formatMultiplier, formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'
import { Monogram } from './icons'

const LAST_GENERATOR_NAME = GENERATORS.find((g) => g.id === LAST_GENERATOR_ID)!.name

export function BoostsPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const caveOwned = engine.state.owned[LAST_GENERATOR_ID]
  const canMenage = caveOwned >= engine.grandMenageCostNow
  const canCadence = engine.state.puanteur >= engine.cadenceCostNow
  const cadenceMaxLevels = engine.cadenceMaxAffordable.levels
  const cadenceMaxMult = 1 + (engine.state.cadenceLevel + cadenceMaxLevels) * CADENCE_EFFECT_PER_LEVEL

  return (
    <div className="boosts-panel">
      <p className="hint">
        Chaque item a son propre bouton « Redémarrer » sur sa ligne, dans l'onglet Générateurs :
        une fois 100 possédés, le redémarrer le remet à 0 en échange d'un bonus de production
        permanent pour cet item précis.
      </p>

      <section className="boost-card">
        <div className="boost-header">
          <Monogram label="Grand ménage" />
          <div>
            <div className="boost-name">Grand ménage</div>
            <div className="boost-desc">
              Reset complet (tous les items et leurs ascensions), mais rend la Cadence moins chère
              pour le reste du cycle.
            </div>
          </div>
        </div>
        <div className="boost-stat">
          <span>Coût</span>
          <strong>
            {formatNumber(engine.grandMenageCostNow)} {LAST_GENERATOR_NAME} ({formatNumber(caveOwned)} possédés)
          </strong>
        </div>
        <div className="boost-stat">
          <span>Grands ménages effectués</span>
          <strong>{engine.state.grandsMenages}</strong>
        </div>
        <button className="boost-button" disabled={!canMenage} onClick={engine.buyGrandMenage}>
          Faire le grand ménage
        </button>
      </section>

      <section className="boost-card">
        <div className="boost-header">
          <Monogram label="Cadence" />
          <div>
            <div className="boost-name">Cadence</div>
            <div className="boost-desc">
              Bonus de production permanent pour le cycle, acheté directement en puanteur. Survit
              aux redémarrages d'item et aux grands ménages.
            </div>
          </div>
        </div>
        <div className="boost-stat">
          <span>Niveau actuel</span>
          <strong>{engine.state.cadenceLevel}</strong>
        </div>
        <div className="boost-stat">
          <span>Bonus de production global</span>
          <strong>x{formatMultiplier(engine.multipliers.cadenceMult)}</strong>
        </div>
        <div className="boost-stat">
          <span>Coût du prochain niveau</span>
          <strong>{formatNumber(engine.cadenceCostNow)} puanteur</strong>
        </div>
        <div className="boost-buttons-row">
          <button className="boost-button" disabled={!canCadence} onClick={engine.buyCadence}>
            +1 niveau
          </button>
          <button className="boost-button" disabled={cadenceMaxLevels === 0} onClick={engine.buyCadenceMax}>
            MAX{cadenceMaxLevels > 0 ? ` (+${cadenceMaxLevels} → x${formatMultiplier(cadenceMaxMult)})` : ''}
          </button>
        </div>
      </section>
    </div>
  )
}
