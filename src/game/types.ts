export type GeneratorId =
  | 'pc'
  | 'clavier'
  | 'chaussettes'
  | 'mug'
  | 'routeur'
  | 'poubelle'
  | 'serveur'
  | 'cave'

export interface GeneratorDef {
  id: GeneratorId
  name: string
  /** Cost of the 1st unit, in puanteur. */
  baseCost: number
  /** Multiplier applied to cost per unit already owned, within a decade of 10. */
  costGrowth: number
  /** Extra cost multiplier applied once per full decade (10, 20, 30...) owned — AD-style. */
  scaling: number
  /** Puanteur/sec produced per owned unit, before multipliers. */
  baseProduction: number
}

export type AxisId = 'vitesse' | 'production' | 'cout' | 'instabilite' | 'synergie'

export interface AxisDef {
  id: AxisId
  name: string
  description: string
}

export interface GameState {
  /** Current spendable puanteur (resets on redoublement). */
  puanteur: number
  /** Lifetime puanteur earned since the last redoublement — feeds the redoublement multiplier formula. */
  earnedSinceReset: number
  /**
   * Highest earnedSinceReset ever reached in a single cycle — a "best run" peak, not a sum
   * across every redoublement. RI's own Infinity is gated the same way: by the current run's
   * Score, which persists through Prestige/Promotion (smaller resets) but isn't a lifetime
   * total across many of them. Gates couche 2.
   */
  bestCycleEarned: number
  owned: Record<GeneratorId, number>
  /**
   * Redémarrages performed since the last Grand ménage (AD's Dimension Boost) — resets items 1-7
   * and grants a cascading production multiplier, strongest on item 1, halving down the chain.
   */
  redemarrages: number
  /**
   * Grands ménages performed since the last redoublement (AD's Antimatter Galaxy) — resets every
   * item and redemarrages, but makes Cadence cheaper/stronger from then on this cycle.
   */
  grandsMenages: number
  /** Cadence level (AD's tickspeed) — bought with puanteur, survives Redémarrage/Grand ménage. */
  cadenceLevel: number
  /**
   * Permanent per-axis multiplier (starts at 1, no cap). Grows only when a redoublement's
   * gain is applied to that axis — no currency, no shop, RI-style.
   */
  axisMultipliers: Record<AxisId, number>
  /**
   * Per-axis floor: the earnedSinceReset reached the last time this axis was chosen at a
   * redoublement (0 if never chosen). Investing in an axis again requires reaching at least
   * this much, on top of the normal redoublement threshold — otherwise a heavily-invested axis
   * could keep compounding on trivially-cheap redoublements while other axes stayed gated by
   * the (potentially much higher) real threshold.
   */
  axisFloors: Record<AxisId, number>
  /** Total number of redoublements performed, ever. */
  redoublements: number
  lastTickAt: number
  createdAt: number
}
