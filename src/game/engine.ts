import {
  ASCENSION_BASE_THRESHOLD,
  ASCENSION_COST_GROWTH_PENALTY,
  ASCENSION_PRODUCTION_GROWTH,
  ASCENSION_THRESHOLD_GROWTH,
  AXES,
  GENERATORS,
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
    axisLevels: Object.fromEntries(AXES.map((a) => [a.id, 0])) as Record<AxisId, number>,
    pr: 0,
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

export function axisCost(axisId: AxisId, level: number): number {
  const def = AXES.find((a) => a.id === axisId)!
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level))
}

export interface Multipliers {
  costMult: number
  speedMult: number
  productionMult: number
  instabilityMult: number
  synergyMult: number
  totalProductionMult: number
}

export function computeMultipliers(axisLevels: Record<AxisId, number>, instabilitySeed = 0): Multipliers {
  const speedMult = 1 + 0.1 * axisLevels.vitesse
  const productionMult = 1 + 0.25 * axisLevels.production
  const costMult = Math.pow(0.97, axisLevels.cout)

  const instabilityLevel = axisLevels.instabilite
  const instabilityBase = 1 + 0.4 * instabilityLevel
  const variance = Math.min(0.6, 0.05 * instabilityLevel)
  const wobble = variance > 0 ? 1 + (instabilitySeed * 2 - 1) * variance : 1
  const instabilityMult = instabilityBase * wobble

  const otherLevelsSum =
    axisLevels.vitesse + axisLevels.production + axisLevels.cout + axisLevels.instabilite
  const synergyMult = 1 + 0.02 * axisLevels.synergie * Math.sqrt(otherLevelsSum)

  const totalProductionMult = speedMult * productionMult * instabilityMult * synergyMult

  return { costMult, speedMult, productionMult, instabilityMult, synergyMult, totalProductionMult }
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

/** Points de Redoublement earned for redoubling now, given lifetime puanteur earned this run. */
export function prForRedoublement(earnedSinceReset: number): number {
  if (earnedSinceReset < 1000) return 0
  return Math.floor(Math.sqrt(earnedSinceReset / 1000))
}

export function redoublementGlobalMult(redoublements: number): number {
  return 1 + 0.15 * redoublements
}
