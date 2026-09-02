import {
  AXES,
  AXIS_MULT_SAFETY_CAP,
  CADENCE_BASE_COST,
  CADENCE_COST_GROWTH,
  CADENCE_EFFECT_PER_LEVEL,
  COST_MULT_FLOOR,
  COUCHE_2_UNLOCK_THRESHOLD,
  DIMENSION_TIER_MULT,
  DIMENSION_TIER_SIZE,
  GENERATORS,
  GRAND_MENAGE_BASE_COST,
  GRAND_MENAGE_CADENCE_DISCOUNT,
  GRAND_MENAGE_COST_STEP,
  REDEMARRAGE_BASE_COST,
  REDEMARRAGE_COST_STEP,
  REDOUBLEMENT_BASE_THRESHOLD,
  REDOUBLEMENT_LOG_SCALE,
  REDOUBLEMENT_THRESHOLD_DECAY,
  REDOUBLEMENT_THRESHOLD_GROWTH_MAX,
  REDOUBLEMENT_THRESHOLD_GROWTH_MIN,
  TIER_BOOST_COEFF,
} from './constants'
import type { AxisId, GameState, GeneratorId } from './types'

export const LAST_GENERATOR_INDEX = GENERATORS.length - 1
export const LAST_GENERATOR_ID = GENERATORS[LAST_GENERATOR_INDEX].id

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
    redemarrages: 0,
    grandsMenages: 0,
    cadenceLevel: 0,
    axisMultipliers: Object.fromEntries(AXES.map((a) => [a.id, 1])) as Record<AxisId, number>,
    axisFloors: Object.fromEntries(AXES.map((a) => [a.id, 0])) as Record<AxisId, number>,
    redoublements: 0,
    lastTickAt: now,
    createdAt: now,
  }
}

/** AD-style stepped production multiplier: doubles every full decade owned (10, 20, 30...). */
export function dimensionTierMultiplier(owned: number): number {
  return Math.pow(DIMENSION_TIER_MULT, Math.floor(owned / DIMENSION_TIER_SIZE))
}

/**
 * Redémarrage's cascading multiplier (AD's Dimension Boost effect): item 1 gets
 * DIMENSION_TIER_MULT^redemarrages, each item after gets one power less, floored at x1.
 */
export function redemarrageCascadeMultiplier(index: number, redemarrages: number): number {
  const power = Math.max(0, redemarrages - index)
  return Math.pow(DIMENSION_TIER_MULT, power)
}

/** Cost of buying the (owned+1)-th..(owned+qty)-th unit of a generator, as a lump sum. */
export function generatorCost(genId: GeneratorId, owned: number, qty: number, costMult: number): number {
  const def = GENERATORS.find((g) => g.id === genId)!
  let total = 0
  for (let i = 0; i < qty; i++) {
    const n = owned + i
    const decade = Math.floor(n / DIMENSION_TIER_SIZE)
    total += def.baseCost * Math.pow(def.costGrowth, n) * Math.pow(def.scaling, decade)
  }
  return total * costMult
}

/** Max number of units affordable with the given budget, and their total cost. */
export function maxAffordable(
  genId: GeneratorId,
  owned: number,
  budget: number,
  costMult: number,
): { qty: number; cost: number } {
  let qty = 0
  let cost = 0
  // Small owned counts in a prototype: linear probe is fine and keeps the math obviously correct.
  while (true) {
    const next =
      generatorCost(genId, owned, qty + 1, costMult) - (qty > 0 ? generatorCost(genId, owned, qty, costMult) : 0)
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
  cadenceMult: number
  totalProductionMult: number
}

/**
 * RI-style: each axis holds a permanent multiplier (starts at 1, no shop, no levels) that only
 * grows when a redoublement's gain is applied to it. `m` below is always that raw multiplier.
 */
export function computeMultipliers(
  axisMultipliers: Record<AxisId, number>,
  cadenceLevel: number,
  instabilitySeed = 0,
): Multipliers {
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

  const cadenceMult = 1 + cadenceLevel * CADENCE_EFFECT_PER_LEVEL

  const totalProductionMult = speedMult * productionMult * wobblyInstabilityMult * synergyMult * cadenceMult

  return {
    costMult,
    speedMult,
    productionMult,
    instabilityMult: wobblyInstabilityMult,
    synergyMult,
    cadenceMult,
    totalProductionMult,
  }
}

/** Multiplier a generator gets from how many of the next tier up are owned. */
export function tierBoostMultiplier(ownedOfTierAbove: number): number {
  return 1 + TIER_BOOST_COEFF * ownedOfTierAbove
}

/** Puanteur/sec produced by a single generator tier right now, tier-boost and redémarrage included. */
export function generatorProductionPerSecond(
  index: number,
  owned: Record<GeneratorId, number>,
  redemarrages: number,
  mult: Multipliers,
): number {
  const def = GENERATORS[index]
  const above = GENERATORS[index + 1]
  const dimMult = dimensionTierMultiplier(owned[def.id])
  const cascadeMult = redemarrageCascadeMultiplier(index, redemarrages)
  const tierBoost = above ? tierBoostMultiplier(owned[above.id]) : 1
  return def.baseProduction * owned[def.id] * dimMult * cascadeMult * tierBoost * mult.totalProductionMult
}

export function productionPerSecond(
  owned: Record<GeneratorId, number>,
  redemarrages: number,
  mult: Multipliers,
): number {
  let total = 0
  for (let i = 0; i < GENERATORS.length; i++) {
    total += generatorProductionPerSecond(i, owned, redemarrages, mult)
  }
  return total
}

/** Puanteur (in units of the last item) needed for the next Redémarrage. */
export function redemarrageCost(redemarrages: number): number {
  return REDEMARRAGE_BASE_COST + REDEMARRAGE_COST_STEP * redemarrages
}

/** Puanteur (in units of the last item) needed for the next Grand ménage. */
export function grandMenageCost(grandsMenages: number): number {
  return GRAND_MENAGE_BASE_COST + GRAND_MENAGE_COST_STEP * grandsMenages
}

/** Puanteur cost of the next Cadence level — cheaper the more Grands ménages this cycle. */
export function cadenceCost(cadenceLevel: number, grandsMenages: number): number {
  const discount = 1 + grandsMenages * GRAND_MENAGE_CADENCE_DISCOUNT
  return (CADENCE_BASE_COST * Math.pow(CADENCE_COST_GROWTH, cadenceLevel)) / discount
}

/** Redémarrage: pays Cave units, resets every item except Cave, cascading boost kicks in. */
export function performRedemarrage(state: GameState): GameState {
  const cost = redemarrageCost(state.redemarrages)
  if (state.owned[LAST_GENERATOR_ID] < cost) return state
  const owned = { ...state.owned }
  for (const def of GENERATORS) {
    if (def.id === LAST_GENERATOR_ID) continue
    owned[def.id] = 0
  }
  owned[LAST_GENERATOR_ID] -= cost
  return { ...state, owned, redemarrages: state.redemarrages + 1 }
}

/** Grand ménage: pays Cave units, resets every item and redemarrages, cheapens Cadence. */
export function performGrandMenage(state: GameState): GameState {
  const cost = grandMenageCost(state.grandsMenages)
  if (state.owned[LAST_GENERATOR_ID] < cost) return state
  const owned = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>
  return { ...state, owned, redemarrages: 0, grandsMenages: state.grandsMenages + 1 }
}

/** Cadence: pays puanteur directly, permanent flat production multiplier for the rest of the cycle. */
export function performBuyCadence(state: GameState): GameState {
  const cost = cadenceCost(state.cadenceLevel, state.grandsMenages)
  if (state.puanteur < cost) return state
  return { ...state, puanteur: state.puanteur - cost, cadenceLevel: state.cadenceLevel + 1 }
}

/** How many Cadence levels `budget` puanteur can afford right now, and their total cost. */
export function maxAffordableCadenceLevels(
  cadenceLevel: number,
  grandsMenages: number,
  budget: number,
): { levels: number; cost: number } {
  let levels = 0
  let cost = 0
  let level = cadenceLevel
  while (true) {
    const next = cadenceCost(level, grandsMenages)
    if (cost + next > budget) break
    cost += next
    levels += 1
    level += 1
    if (levels > 100000) break
  }
  return { levels, cost }
}

/** Cadence MAX: buys every level currently affordable in one go. */
export function performBuyCadenceMax(state: GameState): GameState {
  const { levels, cost } = maxAffordableCadenceLevels(state.cadenceLevel, state.grandsMenages, state.puanteur)
  if (levels === 0) return state
  return { ...state, puanteur: state.puanteur - cost, cadenceLevel: state.cadenceLevel + levels }
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
 * The puanteur an axis-specific redoublement must clear — the normal redoublement threshold,
 * OR that axis's own floor, whichever is higher. The floor is the earnedSinceReset the last
 * time *this* axis was chosen (0 if never): without it, a player could pick the same axis every
 * single redoublement and keep compounding it at whatever the (comparatively tiny) global
 * threshold happens to be, while every other axis sat untouched behind that same cheap gate —
 * re-investing in an axis you've already grown should cost at least as much as it did last time,
 * not the same trivial amount as touching a fresh one.
 */
export function axisRedoublementThreshold(redoublements: number, axisFloor: number): number {
  return Math.max(redoublementThreshold(redoublements), axisFloor)
}

/**
 * Multiplier gained by redoubling into a given axis right now, given puanteur earned this cycle
 * and that axis's effective threshold (see axisRedoublementThreshold) — RI's P.Mult idea: no
 * currency, the redoublement itself is the reward, applied directly to one axis. Same family as
 * Antimatter Dimensions' own Infinity Points formula (IP = 10^(log10(antimatter)/308 - 0.75),
 * i.e. antimatter^(1/308) scaled down — a fractional power / log-shaped curve with no hard
 * ceiling): here, gain = LOG_SCALE * ln(earnedSinceReset / threshold). Two things keep this from
 * spiraling or being spammable:
 * - The threshold rising with `redoublements`, and with that axis's own floor: earning the same
 *   *relative* amount always takes proportionally more effort than last time, however strong
 *   you've become, and re-growing an axis you've already invested in specifically can't be
 *   cheaper than it was the last time you grew it.
 * - ln(1) = 0: gain is exactly 0 right at the threshold and only grows with accumulation
 *   *beyond* it, so redoubling the instant it unlocks is worthless. But unlike a hard cap, it
 *   never fully stalls either — every further multiple of accumulation keeps adding a bit more
 *   (doubling the surplus always adds ln(2) ≈ 0.69 × LOG_SCALE, however much you've already
 *   accumulated), so waiting longer always keeps paying off, just less and less per extra wait.
 */
export function redoublementMultiplierGain(earnedSinceReset: number, threshold: number): number {
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
  const mult = computeMultipliers(state.axisMultipliers, state.cadenceLevel, 0.5)
  const rate = productionPerSecond(state.owned, state.redemarrages, mult)
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

