import {
  ASCENSION_BASE_THRESHOLD,
  ASCENSION_COST_GROWTH_PENALTY,
  ASCENSION_PRODUCTION_GROWTH,
  ASCENSION_THRESHOLD_GROWTH,
  AXES,
  AXIS_MULT_SAFETY_CAP,
  COST_MULT_FLOOR,
  COUCHE_2_UNLOCK_THRESHOLD,
  GENERATORS,
  REDOUBLEMENT_BASE_THRESHOLD,
  REDOUBLEMENT_LOG_SCALE,
  REDOUBLEMENT_THRESHOLD_DECAY,
  REDOUBLEMENT_THRESHOLD_GROWTH_MAX,
  REDOUBLEMENT_THRESHOLD_GROWTH_MIN,
  TIER_BOOST_COEFF,
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
    bestCycleEarned: 0,
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
  const costMult = Math.max(COST_MULT_FLOOR, 1 / Math.sqrt(axisMultipliers.cout))

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

/** Multiplier a generator gets from how many of the next tier up are owned. */
export function tierBoostMultiplier(ownedOfTierAbove: number): number {
  return 1 + TIER_BOOST_COEFF * ownedOfTierAbove
}

/** Puanteur/sec produced by a single generator tier right now, tier-boost included. */
export function generatorProductionPerSecond(
  index: number,
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  mult: Multipliers,
): number {
  const def = GENERATORS[index]
  const above = GENERATORS[index + 1]
  const ascMult = ascensionMultiplier(ascensionLevels[def.id])
  const tierBoost = above ? tierBoostMultiplier(owned[above.id]) : 1
  return def.baseProduction * owned[def.id] * ascMult * tierBoost * mult.totalProductionMult
}

export function productionPerSecond(
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  mult: Multipliers,
): number {
  let total = 0
  for (let i = 0; i < GENERATORS.length; i++) {
    total += generatorProductionPerSecond(i, owned, ascensionLevels, mult)
  }
  return total
}

/** Per-step growth rate of the threshold, decaying from a high early rate toward a low one. */
function thresholdStepGrowth(redoublements: number): number {
  return (
    REDOUBLEMENT_THRESHOLD_GROWTH_MIN +
    (REDOUBLEMENT_THRESHOLD_GROWTH_MAX - REDOUBLEMENT_THRESHOLD_GROWTH_MIN) *
      Math.exp(-redoublements / REDOUBLEMENT_THRESHOLD_DECAY)
  )
}

/** Puanteur that must be earned this run before the next redoublement is worth doing. */
export function redoublementThreshold(redoublements: number): number {
  let threshold = REDOUBLEMENT_BASE_THRESHOLD
  for (let i = 0; i < redoublements; i++) {
    threshold *= thresholdStepGrowth(i)
  }
  return threshold
}

/**
 * Multiplier gained by redoubling now, given puanteur earned this cycle and how many
 * redoublements are already banked — RI's P.Mult idea: no currency, the redoublement itself is
 * the reward, applied directly to one axis. Same family as Antimatter Dimensions' own Infinity
 * Points formula (IP = 10^(log10(antimatter)/308 - 0.75), i.e. antimatter^(1/308) scaled down —
 * a fractional power / log-shaped curve with no hard ceiling): here, gain = LOG_SCALE *
 * ln(earnedSinceReset / threshold). Two things keep this from spiraling or being spammable:
 * - The threshold rising with `redoublements`: earning the same *relative* amount always takes
 *   proportionally more effort than the last redoublement, however strong you've become.
 * - ln(1) = 0: gain is exactly 0 right at the threshold and only grows with accumulation
 *   *beyond* it, so redoubling the instant it unlocks is worthless. But unlike a hard cap, it
 *   never fully stalls either — every further multiple of accumulation keeps adding a bit more
 *   (doubling the surplus always adds ln(2) ≈ 0.69 × LOG_SCALE, however much you've already
 *   accumulated), so waiting longer always keeps paying off, just less and less per extra wait.
 */
export function redoublementMultiplierGain(earnedSinceReset: number, redoublements: number): number {
  const threshold = redoublementThreshold(redoublements)
  if (earnedSinceReset <= threshold) return 0
  return REDOUBLEMENT_LOG_SCALE * Math.log(earnedSinceReset / threshold)
}

/** Applies a redoublement's gain to an axis multiplier, capped as a last line of defense. */
export function applyAxisGain(current: number, gain: number): number {
  return Math.min(current * (1 + gain), AXIS_MULT_SAFETY_CAP)
}

/** Whether couche 2 (Passage d'année) is unlocked, given the best single-cycle peak reached. */
export function isCouche2Unlocked(bestCycleEarned: number): boolean {
  return bestCycleEarned >= COUCHE_2_UNLOCK_THRESHOLD
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
      bestCycleEarned: Math.max(state.bestCycleEarned, state.earnedSinceReset + gained),
      lastTickAt: Date.now(),
    },
    gained,
  }
}
