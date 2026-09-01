import { useState } from 'react'
import { resetSave } from '../game/save'

export function SettingsPanel() {
  const [confirming, setConfirming] = useState(false)

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    resetSave()
    window.location.reload()
  }

  return (
    <div className="settings-panel">
      <section className="boost-card">
        <div className="boost-name">Build en cours</div>
        <div className="boost-stat">
          <span>Run</span>
          <strong>#{__BUILD_INFO__.runNumber}</strong>
        </div>
        <div className="boost-stat">
          <span>Commit</span>
          <strong>{__BUILD_INFO__.commit}</strong>
        </div>
        <div className="boost-stat">
          <span>Compilé le</span>
          <strong>{new Date(__BUILD_INFO__.builtAt).toLocaleString('fr-FR')}</strong>
        </div>
      </section>

      <section className="boost-card">
        <div className="boost-name">Sauvegarde</div>
        <p className="hint">
          Remet ta progression complètement à zéro — items, redémarrages, grands ménages, cadence,
          axes, redoublements. Irréversible.
        </p>
        <button
          className={confirming ? 'boost-button danger' : 'boost-button'}
          onClick={handleReset}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? 'Confirmer la remise à zéro' : 'Réinitialiser ma sauvegarde'}
        </button>
      </section>
    </div>
  )
}
