import { useState } from 'react'
import { useGameEngine } from './game/useGameEngine'
import { formatNumber, formatRate } from './game/format'
import { GeneratorList } from './components/GeneratorList'
import { AxesPanel } from './components/AxesPanel'
import { BoostsPanel } from './components/BoostsPanel'
import { RedoublementPanel } from './components/RedoublementPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { OfflineModal } from './components/OfflineModal'
import { Scene } from './components/Scene'
import { AxesIcon, BoostsIcon, GeneratorsIcon, RedoublementIcon, SettingsIcon } from './components/icons'

type Tab = 'generateurs' | 'boosts' | 'axes' | 'redoublement' | 'reglages'

export default function App() {
  const engine = useGameEngine()
  const [tab, setTab] = useState<Tab>('generateurs')

  return (
    <div className="app">
      <header className="header">
        <div className="header-main">
          <div>
            <div className="puanteur-value">{formatNumber(engine.state.puanteur)}</div>
            <div className="puanteur-rate">{formatRate(engine.productionRate)} de puanteur</div>
          </div>
        </div>
        <div className="header-sub">Redoublement #{engine.state.redoublements}</div>
      </header>

      <Scene engine={engine} />

      <main className="content">
        {tab === 'generateurs' && <GeneratorList engine={engine} />}
        {tab === 'boosts' && <BoostsPanel engine={engine} />}
        {tab === 'axes' && <AxesPanel engine={engine} />}
        {tab === 'redoublement' && <RedoublementPanel engine={engine} />}
        {tab === 'reglages' && <SettingsPanel engine={engine} />}
      </main>

      <nav className="bottom-nav">
        <button className={tab === 'generateurs' ? 'active' : ''} onClick={() => setTab('generateurs')}>
          <GeneratorsIcon />
          <span>Générateurs</span>
        </button>
        <button className={tab === 'boosts' ? 'active' : ''} onClick={() => setTab('boosts')}>
          <BoostsIcon />
          <span>Boosts</span>
        </button>
        <button className={tab === 'axes' ? 'active' : ''} onClick={() => setTab('axes')}>
          <AxesIcon />
          <span>Axes</span>
        </button>
        <button className={tab === 'redoublement' ? 'active' : ''} onClick={() => setTab('redoublement')}>
          <RedoublementIcon />
          <span>Redoublement</span>
        </button>
        <button className={tab === 'reglages' ? 'active' : ''} onClick={() => setTab('reglages')}>
          <SettingsIcon />
          <span>Réglages</span>
        </button>
      </nav>

      {engine.offlineReport && (
        <OfflineModal report={engine.offlineReport} onClose={engine.dismissOfflineReport} />
      )}
    </div>
  )
}
