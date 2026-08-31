import { formatNumber } from '../game/format'
import type { OfflineReport } from '../game/useGameEngine'

export function OfflineModal({ report, onClose }: { report: OfflineReport; onClose: () => void }) {
  const hours = Math.floor(report.seconds / 3600)
  const minutes = Math.floor((report.seconds % 3600) / 60)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Bon retour !</h2>
        <p>
          Pendant ton absence ({hours > 0 ? `${hours}h ` : ''}
          {minutes}min), tu as produit <strong>{formatNumber(report.puanteurGained)}</strong> de puanteur.
        </p>
        <button onClick={onClose}>Continuer</button>
      </div>
    </div>
  )
}
