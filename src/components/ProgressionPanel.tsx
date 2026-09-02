import { useState } from 'react'
import { AxesPanel } from './AxesPanel'
import { BoostsPanel } from './BoostsPanel'
import { RedoublementPanel } from './RedoublementPanel'
import type { useGameEngine } from '../game/useGameEngine'

type Section = 'boosts' | 'axes' | 'redoublement'

/**
 * Boosts, Axes and Redoublement are all "make the current run stronger" mechanics — grouped
 * under one tab with pill sub-navigation instead of three separate bottom-nav entries, so the
 * whole progression story for couche 1 lives in one place.
 */
export function ProgressionPanel({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const [section, setSection] = useState<Section>('boosts')

  return (
    <div>
      <div className="section-nav">
        <button className={section === 'boosts' ? 'active' : ''} onClick={() => setSection('boosts')}>
          Boosts
        </button>
        <button className={section === 'axes' ? 'active' : ''} onClick={() => setSection('axes')}>
          Axes
        </button>
        <button className={section === 'redoublement' ? 'active' : ''} onClick={() => setSection('redoublement')}>
          Redoublement
        </button>
      </div>

      <div className="section-content">
        {section === 'boosts' && <BoostsPanel engine={engine} />}
        {section === 'axes' && <AxesPanel engine={engine} />}
        {section === 'redoublement' && <RedoublementPanel engine={engine} />}
      </div>
    </div>
  )
}
