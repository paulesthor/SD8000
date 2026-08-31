import { formatNumber } from '../game/format'
import type { useGameEngine } from '../game/useGameEngine'

export function RedoublementPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const canRedouble = engine.previewPr > 0

  return (
    <div className="redoublement-panel">
      <p className="hint">
        Redoubler remet ta puanteur et tes générateurs à zéro, mais te donne des Points de Redoublement
        (PR) à dépenser dans tes axes — et un bonus de production permanent. Plus tu accumules de
        puanteur avant de redoubler, plus tu gagnes de PR.
      </p>

      <div className="redoublement-stat">
        <span>Puanteur accumulée ce cycle</span>
        <strong>{formatNumber(engine.state.earnedSinceReset)}</strong>
      </div>
      <div className="redoublement-stat">
        <span>PR gagnés si tu redoubles maintenant</span>
        <strong>{formatNumber(engine.previewPr)}</strong>
      </div>
      <div className="redoublement-stat">
        <span>Bonus permanent actuel</span>
        <strong>x{(1 + 0.15 * engine.state.redoublements).toFixed(2)}</strong>
      </div>

      <button className="redouble-button" disabled={!canRedouble} onClick={engine.redoubler}>
        {canRedouble ? 'Redoubler' : 'Pas assez de puanteur accumulée'}
      </button>
    </div>
  )
}
