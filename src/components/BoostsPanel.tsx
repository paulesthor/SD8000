import { LAST_GENERATOR_ID } from '../game/engine'
import { GENERATORS } from '../game/constants'
import { formatMultiplier, formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'
import { Monogram } from './icons'

const LAST_GENERATOR_NAME = GENERATORS.find((g) => g.id === LAST_GENERATOR_ID)!.name

export function BoostsPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const caveOwned = engine.state.owned[LAST_GENERATOR_ID]
  const canRedemarrer = caveOwned >= engine.redemarrageCostNow
  const canMenage = caveOwned >= engine.grandMenageCostNow
  const canCadence = engine.state.puanteur >= engine.cadenceCostNow

  return (
    <div className="boosts-panel">
      <section className="boost-card">
        <div className="boost-header">
          <Monogram label="Redémarrage" />
          <div>
            <div className="boost-name">Redémarrage</div>
            <div className="boost-desc">
              Vide tous les items sauf {LAST_GENERATOR_NAME}, en échange d'un gros bonus sur les
              premiers items qui s'estompe sur les suivants.
            </div>
          </div>
        </div>
        <div className="boost-stat">
          <span>Coût</span>
          <strong>
            {formatNumber(engine.redemarrageCostNow)} {LAST_GENERATOR_NAME} ({formatNumber(caveOwned)} possédés)
          </strong>
        </div>
        <div className="boost-stat">
          <span>Redémarrages effectués</span>
          <strong>{engine.state.redemarrages}</strong>
        </div>
        <button className="boost-button" disabled={!canRedemarrer} onClick={engine.buyRedemarrage}>
          Redémarrer
        </button>
      </section>

      <section className="boost-card">
        <div className="boost-header">
          <Monogram label="Grand ménage" />
          <div>
            <div className="boost-name">Grand ménage</div>
            <div className="boost-desc">
              Reset complet (items + redémarrages), mais rend la Cadence moins chère pour le reste
              du cycle.
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
              aux redémarrages et grands ménages.
            </div>
          </div>
        </div>
        <div className="boost-stat">
          <span>Niveau actuel</span>
          <strong>
            {engine.state.cadenceLevel} (x{formatMultiplier(engine.multipliers.cadenceMult)} prod.)
          </strong>
        </div>
        <div className="boost-stat">
          <span>Coût du prochain niveau</span>
          <strong>{formatNumber(engine.cadenceCostNow)} puanteur</strong>
        </div>
        <button className="boost-button" disabled={!canCadence} onClick={engine.buyCadence}>
          Augmenter la cadence
        </button>
      </section>
    </div>
  )
}
