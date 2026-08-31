import {
  ASCENSION_BASE_THRESHOLD,
  ASCENSION_COST_GROWTH_PENALTY,
  ASCENSION_PRODUCTION_GROWTH,
  ASCENSION_THRESHOLD_GROWTH,
  AXES,
  GENERATORS,
  REDOUBLEMENT_DIVISOR,
  REDOUBLEMENT_EXPONENT,
  REDOUBLEMENT_MIN_EARNED,
  REDOUBLEMENT_MULT_SCALE,
} from './constants'
import type { AxisId, GameState, GeneratorDef, GeneratorId } from './types'

export function createInitialState(): GameState {
  const now = Date.now()
  const owned = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>
  // The player's first PC pourri is free — otherwise there's no way to earn the puanteur to buy it.
  owned.pc = 1
  return {
    puanteur: 0,
    earnedSinceReset: 0,
    owned,
    ascensionLevels: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>,
    axisMultipliers: Object.fromEntries(AXES.map((a) => [a.id, 1])) as Record<AxisId, number>,
    redoublements: 0,
    lastTickAt: now,
    createdAt: now,
  }
}

/** Owned units required to ascend a generator currently at this ascension level. */
export function ascensionThreshold(level: number): number {
  return Math.round(ASCENSION_BASE_THRESHOLD * Math.pow(ASCENSION_THRESHOLD_GROWTH, level))
}

/** Permanent per-unit production multiplier granted by a generator's ascension level. */
export function ascensionMultiplier(level: number): number {
  return Math.pow(ASCENSION_PRODUCTION_GROWTH, level)
}

/** Ascending makes the generator refill slower: cost grows faster per level. */
function effectiveCostGrowth(def: GeneratorDef, ascLevel: number): number {
  return def.costGrowth * (1 + ASCENSION_COST_GROWTH_PENALTY * ascLevel)
}

/** Cost of buying the (owned+1)-th..(owned+qty)-th unit of a generator, as a lump sum. */
export function generatorCost(
  genId: GeneratorId,
  owned: number,
  qty: number,
  costMult: number,
  ascLevel = 0,
): number {
  const def = GENERATORS.find((g) => g.id === genId)!
  const growth = effectiveCostGrowth(def, ascLevel)
  let total = 0
  for (let i = 0; i < qty; i++) {
    total += def.baseCost * Math.pow(growth, owned + i)
  }
  return total * costMult
}

/** Max number of units affordable with the given budget, and their total cost. */
export function maxAffordable(
  genId: GeneratorId,
  owned: number,
  budget: number,
  costMult: number,
  ascLevel = 0,
): { qty: number; cost: number } {
  let qty = 0
  let cost = 0
  // Small owned counts in a prototype: linear probe is fine and keeps the math obviously correct.
  while (true) {
    const next =
      generatorCost(genId, owned, qty + 1, costMult, ascLevel) -
      (qty > 0 ? generatorCost(genId, owned, qty, costMult, ascLevel) : 0)
    if (cost + next > budget) break
    cost += next
    qty += 1
    if (qty > 100000) break
  }
  return { qty, cost }
}

export interface Multipliers {
  costMult: number
  speedMult: number
  productionMult: number
  instabilityMult: number
  synergyMult: number
  totalProductionMult: number
}

/**
 * RI-style: each axis holds a permanent multiplier (starts at 1, no shop, no levels) that only
 * grows when a redoublement's gain is applied to it. `m` below is always that raw multiplier.
 */
export function computeMultipliers(axisMultipliers: Record<AxisId, number>, instabilitySeed = 0): Multipliers {
  const speedMult = axisMultipliers.vitesse
  const productionMult = axisMultipliers.production
  const costMult = 1 / Math.sqrt(axisMultipliers.cout)

  const instabilityMult = axisMultipliers.instabilite
  const variance = Math.min(0.6, (instabilityMult - 1) * 0.1)
  const wobble = variance > 0 ? 1 + (instabilitySeed * 2 - 1) * variance : 1
  const wobblyInstabilityMult = instabilityMult * wobble

  const otherGrowth =
    axisMultipliers.vitesse - 1 + (axisMultipliers.production - 1) + (axisMultipliers.cout - 1) + (instabilityMult - 1)
  const synergyMult = 1 + (axisMultipliers.synergie - 1) * Math.sqrt(Math.max(0, otherGrowth)) * 0.1

  const totalProductionMult = speedMult * productionMult * wobblyInstabilityMult * synergyMult

  return { costMult, speedMult, productionMult, instabilityMult: wobblyInstabilityMult, synergyMult, totalProductionMult }
}

export function productionPerSecond(
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  mult: Multipliers,
): number {
  let total = 0
  for (const def of GENERATORS) {
    const ascMult = ascensionMultiplier(ascensionLevels[def.id])
    total += def.baseProduction * owned[def.id] * ascMult * mult.totalProductionMult
  }
  return total
}

/**
 * Multiplier gained by redoubling now, given lifetime puanteur earned this run — RI's P.Mult
 * idea: no currency, the redoublement itself is the reward, applied directly to one axis.
 * Rendements décroissants: doubling earned puanteur gives ~+50% more gain, not a flat wall.
 */
export function redoublementMultiplierGain(earnedSinceReset: number): number {
  if (earnedSinceReset < REDOUBLEMENT_MIN_EARNED) return 0
  return Math.pow(earnedSinceReset / REDOUBLEMENT_DIVISOR, REDOUBLEMENT_EXPONENT) * REDOUBLEMENT_MULT_SCALE
}

/**
 * Applies `seconds` worth of production to a state as a lump sum — used both for offline
 * catch-up on load and for catching up time lost while the tab was backgrounded/throttled.
 */
export function applyElapsedProduction(state: GameState, seconds: number): { state: GameState; gained: number } {
  const mult = computeMultipliers(state.axisMultipliers, 0.5)
  const rate = productionPerSecond(state.owned, state.ascensionLevels, mult)
  const gained = rate * seconds
  return {
    state: {
      ...state,
      puanteur: state.puanteur + gained,
      earnedSinceReset: state.earnedSinceReset + gained,
      lastTickAt: Date.now(),
    },
    gained,
  }
}
