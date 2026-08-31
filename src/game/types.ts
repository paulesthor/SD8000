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
  /** Multiplier applied to cost per unit already owned. */
  costGrowth: number
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
  owned: Record<GeneratorId, number>
  /** Per-generator ascension level — permanent, survives redoublements. */
  ascensionLevels: Record<GeneratorId, number>
  /**
   * Permanent per-axis multiplier (starts at 1, no cap). Grows only when a redoublement's
   * gain is applied to that axis — no currency, no shop, RI-style.
   */
  axisMultipliers: Record<AxisId, number>
  /** Total number of redoublements performed, ever. */
  redoublements: number
  lastTickAt: number
  createdAt: number
}
