import { PixelCharacter } from './PixelCharacter'
import type { useGameEngine } from '../game/useGameEngine'

/** 0 = nothing yet, 1/2/3 = escalating visual intensity as the generator is owned more. */
function tierOf(owned: number): 0 | 1 | 2 | 3 {
  if (owned <= 0) return 0
  if (owned < 10) return 1
  if (owned < 50) return 2
  return 3
}

export function Scene({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
  const o = engine.state.owned
  const tPc = tierOf(o.pc)
  const tClavier = tierOf(o.clavier)
  const tChaussettes = tierOf(o.chaussettes)
  const tMug = tierOf(o.mug)
  const tRouteur = tierOf(o.routeur)
  const tPoubelle = tierOf(o.poubelle)
  const tServeur = tierOf(o.serveur)
  const tCave = tierOf(o.cave)

  return (
    <div className="scene" data-cave={tCave}>
      {tCave > 0 && <div className="fx-vignette" style={{ opacity: tCave * 0.15 }} />}
      {tPc > 0 && <div className={`fx-scanlines tier-${tPc}`} />}
      {tServeur > 0 && <div className={`fx-heat tier-${tServeur}`} />}

      <div className="scene-character">
        <PixelCharacter size={120} />
      </div>

      {tChaussettes > 0 && (
        <div className="fx-stink">
          {Array.from({ length: tChaussettes }).map((_, i) => (
            <span key={i} className="fx-stink-line" style={{ left: `${38 + i * 10}%`, animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
      )}

      {tMug > 0 && (
        <div className="fx-steam">
          {Array.from({ length: tMug }).map((_, i) => (
            <span key={i} className="fx-steam-puff" style={{ left: `${18 + i * 6}%`, animationDelay: `${i * 0.8}s` }} />
          ))}
        </div>
      )}

      {tClavier > 0 && (
        <div className="fx-crumbs">
          {Array.from({ length: tClavier * 2 }).map((_, i) => (
            <span
              key={i}
              className="fx-crumb"
              style={{ left: `${20 + ((i * 37) % 60)}%`, animationDelay: `${(i % 5) * 0.9}s` }}
            />
          ))}
        </div>
      )}

      {tPoubelle > 0 && (
        <div className="fx-flies">
          {Array.from({ length: tPoubelle * 2 }).map((_, i) => (
            <span
              key={i}
              className="fx-fly"
              style={{
                left: `${30 + ((i * 53) % 40)}%`,
                top: `${20 + ((i * 29) % 40)}%`,
                animationDelay: `${(i % 4) * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {tRouteur > 0 && <div className={`fx-wifi tier-${tRouteur}`} aria-hidden />}

      {tServeur > 0 && (
        <div className="fx-sparks">
          {Array.from({ length: tServeur }).map((_, i) => (
            <span key={i} className="fx-spark" style={{ right: `${8 + i * 5}%`, animationDelay: `${i * 1.1}s` }} />
          ))}
        </div>
      )}
    </div>
  )
}
