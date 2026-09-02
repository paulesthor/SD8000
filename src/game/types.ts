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
  /** Relative weight of how fast this item's own multiplier grows per second of "lap" time. */
  growthRate: number
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
  /**
   * Level bought with puanteur for each item — same role "owned" used to have, renamed because
   * items no longer directly produce puanteur; level now only sets how fast that item's own
   * multiplier (itemMultipliers below) grows.
   */
  owned: Record<GeneratorId, number>
  /**
   * Each item's own multiplier — RI-style "circles": every tick it grows a little on its own
   * (faster the higher that item's level), independently of every other item. Puanteur/sec is
   * the *product* of all these, not their sum. Starts at 1 (neutral) and only ever grows —
   * redémarrer (below) resets an item's level, never this.
   */
  itemMultipliers: Record<GeneratorId, number>
  /**
   * Per-item ascension level — each item independently caps out at a level (growing every time,
   * see itemAscensionCap); past that, redémarrer resets that item's *level* only (its multiplier
   * above is untouched) in exchange for a permanent boost to how fast it grows from then on.
   * Replaces the old global Redémarrage (Dimension Boost) mechanic.
   */
  ascensionLevels: Record<GeneratorId, number>
  /**
   * Grands ménages performed since the last redoublement (AD's Antimatter Galaxy) — resets every
   * item and their ascension levels, but makes Cadence cheaper/stronger from then on this cycle.
   */
  grandsMenages: number
  /** Cadence level (AD's tickspeed) — bought with puanteur, survives per-item Redémarrage/Grand ménage. */
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
