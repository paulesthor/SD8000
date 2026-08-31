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
  /** PR cost of level 1, grows by costGrowth per level. */
  baseCost: number
  costGrowth: number
}

export interface GameState {
  /** Current spendable puanteur (resets on redoublement). */
  puanteur: number
  /** Lifetime puanteur earned since the last redoublement — feeds the PR formula. */
  earnedSinceReset: number
  owned: Record<GeneratorId, number>
  axisLevels: Record<AxisId, number>
  /** Points de Redoublement banked, spendable on axis levels. */
  pr: number
  /** Total number of redoublements performed, ever. */
  redoublements: number
  lastTickAt: number
  createdAt: number
}
