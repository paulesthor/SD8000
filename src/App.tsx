import { useState } from 'react'
import { useGameEngine } from './game/useGameEngine'
import { formatNumber, formatRate } from './game/format'
import { GeneratorList } from './components/GeneratorList'
import { ProgressionPanel } from './components/ProgressionPanel'
import { QuickStats } from './components/QuickStats'
import { SettingsPanel } from './components/SettingsPanel'
import { OfflineModal } from './components/OfflineModal'
import { Scene } from './components/Scene'
import { GeneratorsIcon, ProgressionIcon, SettingsIcon } from './components/icons'

type Tab = 'generateurs' | 'progression' | 'reglages'

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
          <div className="header-redoublement">Redoublement #{engine.state.redoublements}</div>
        </div>
      </header>

      {tab === 'generateurs' && (
        <>
          <QuickStats engine={engine} />
          <Scene engine={engine} />
        </>
      )}

      <main className="content">
        {tab === 'generateurs' && <GeneratorList engine={engine} />}
        {tab === 'progression' && <ProgressionPanel engine={engine} />}
        {tab === 'reglages' && <SettingsPanel engine={engine} />}
      </main>

      <nav className="bottom-nav">
        <button className={tab === 'generateurs' ? 'active' : ''} onClick={() => setTab('generateurs')}>
          <GeneratorsIcon />
          <span>Générateurs</span>
        </button>
        <button className={tab === 'progression' ? 'active' : ''} onClick={() => setTab('progression')}>
          <ProgressionIcon />
          <span>Progression</span>
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
