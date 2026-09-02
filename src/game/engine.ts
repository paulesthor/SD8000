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
  ITEM_ASCENSION_BOOST,
  ITEM_ASCENSION_CAP,
  ITEM_ASCENSION_CAP_GROWTH,
  ITEM_ASCENSION_COST_PENALTY,
  ITEM_ASCENSION_RESET_LEVEL,
  ITEM_MULT_GROWTH_SCALE,
  PRODUCTION_EXPONENT,
  PRODUCTION_EXPONENT_DECAY,
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
    itemMultipliers: Object.fromEntries(GENERATORS.map((g) => [g.id, 1])) as Record<GeneratorId, number>,
    ascensionLevels: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>,
    grandsMenages: 0,
    cadenceLevel: 0,
    axisMultipliers: Object.fromEntries(AXES.map((a) => [a.id, 1])) as Record<AxisId, number>,
    axisFloors: Object.fromEntries(AXES.map((a) => [a.id, 0])) as Record<AxisId, number>,
    redoublements: 0,
    lastTickAt: now,
    createdAt: now,
  }
}

/** AD-style stepped growth-speed multiplier: doubles every full decade of level owned (10, 20, 30...). */
export function dimensionTierMultiplier(owned: number): number {
  return Math.pow(DIMENSION_TIER_MULT, Math.floor(owned / DIMENSION_TIER_SIZE))
}

/** Growth-speed multiplier from an item's own ascension level (boosts how fast its multiplier climbs). */
export function itemAscensionMultiplier(level: number): number {
  return Math.pow(ITEM_ASCENSION_BOOST, level)
}

/** Level needed to ascend this item again, given its current ascension level — grows every level. */
export function itemAscensionCap(level: number): number {
  return ITEM_ASCENSION_CAP + level * ITEM_ASCENSION_CAP_GROWTH
}

/** Cost of buying the (owned+1)-th..(owned+qty)-th level of a generator, as a lump sum. */
export function generatorCost(
  genId: GeneratorId,
  owned: number,
  qty: number,
  costMult: number,
  ascLevel = 0,
): number {
  const def = GENERATORS.find((g) => g.id === genId)!
  const costGrowth = def.costGrowth * (1 + ITEM_ASCENSION_COST_PENALTY * ascLevel)
  let total = 0
  for (let i = 0; i < qty; i++) {
    const n = owned + i
    const decade = Math.floor(n / DIMENSION_TIER_SIZE)
    total += def.baseCost * Math.pow(costGrowth, n) * Math.pow(def.scaling, decade)
  }
  return total * costMult
}

/** Max number of levels affordable with the given budget, and their total cost. */
export function maxAffordable(
  genId: GeneratorId,
  owned: number,
  budget: number,
  costMult: number,
  ascLevel = 0,
): { qty: number; cost: number } {
  let qty = 0
  let cost = 0
  const room = Math.max(0, itemAscensionCap(ascLevel) - owned)
  // Small owned counts in a prototype: linear probe is fine and keeps the math obviously correct.
  while (qty < room) {
    const next =
      generatorCost(genId, owned, qty + 1, costMult, ascLevel) -
      (qty > 0 ? generatorCost(genId, owned, qty, costMult, ascLevel) : 0)
    if (cost + next > budget) break
    cost += next
    qty += 1
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

/**
 * How fast a single item's own multiplier grows right now, per second — RI's "lap speed": driven
 * by its level (stepped doubling, same shape as before), its ascension level, how many of the
 * next tier up are owned, and that item's relative growth weight.
 */
export function itemGrowthRate(
  index: number,
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
): number {
  const def = GENERATORS[index]
  const above = GENERATORS[index + 1]
  const dimMult = dimensionTierMultiplier(owned[def.id])
  const ascMult = itemAscensionMultiplier(ascensionLevels[def.id])
  const tierBoost = above ? tierBoostMultiplier(owned[above.id]) : 1
  // owned=0 must mean zero growth (an item you haven't bought at all shouldn't passively climb
  // just because its growthRate weight is large) — same role `owned` played as a direct linear
  // factor in the old additive-production formula this replaced.
  return def.growthRate * ITEM_MULT_GROWTH_SCALE * owned[def.id] * dimMult * ascMult * tierBoost
}

/** Advances every item's own multiplier by `seconds` of "lap" time at its current growth rate. */
export function tickItemMultipliers(
  itemMultipliers: Record<GeneratorId, number>,
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  seconds: number,
): Record<GeneratorId, number> {
  const next = { ...itemMultipliers }
  for (let i = 0; i < GENERATORS.length; i++) {
    const def = GENERATORS[i]
    next[def.id] += itemGrowthRate(i, owned, ascensionLevels) * seconds
  }
  return next
}

/**
 * Puanteur/sec right now — RI's own formula: the *product* of every circle's multiplier, raised
 * to a common exponent (tames 8 compounding multipliers from exploding), times the usual
 * axis/cadence multipliers.
 *
 * The exponent is NOT a fixed constant (PRODUCTION_EXPONENT below) — it decays smoothly from 1
 * (full linear scaling, right when only one item is meaningfully grown) toward
 * PRODUCTION_EXPONENT as more items grow in parallel. A first version of this counted "active"
 * items with a hard `mult > 1` threshold and used 1/activeCount as the exponent — retour
 * utilisateur: buying (and thereby soon growing) a new item could make total puanteur/sec drop,
 * e.g. 721/s -> 213/s right when Mug de café's multiplier first ticked past 1. Verified with the
 * real engine: that's exactly what happened — the moment a barely-grown item (mult ~1.0001,
 * contributing almost nothing to the product) crossed the threshold, the discrete jump from
 * 1/3 to 1/4 exponent shrank every *other* already-large item's contribution far more than the
 * new item's negligible presence could offset, a real production drop from adding an item that
 * should only ever help.
 *
 * The fix: no hard threshold. `logGrowth` (ln of the whole product, i.e. the sum of each item's
 * own ln(mult)) grows only continuously — a barely-touched item adds a vanishingly small amount,
 * not a discrete step — and the exponent is a smooth exponential decay in that quantity. This
 * guarantees adding any amount of growth, however small, can only ever move production up or
 * leave it unchanged, never down: verified with the real engine over hundreds of simulated
 * ticks of continuous buying that puanteur/sec is now monotonically non-decreasing throughout.
 */
export function productionPerSecond(itemMultipliers: Record<GeneratorId, number>, mult: Multipliers): number {
  let product = 1
  let logGrowth = 0
  for (const def of GENERATORS) {
    const m = itemMultipliers[def.id]
    product *= m
    logGrowth += Math.log(m)
  }
  const decay = Math.exp(-logGrowth / PRODUCTION_EXPONENT_DECAY)
  const exponent = PRODUCTION_EXPONENT + (1 - PRODUCTION_EXPONENT) * decay
  return Math.pow(product, exponent) * mult.totalProductionMult
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

/** Whether this item has reached its (level-dependent) ascension cap and can be redémarré. */
export function canAscendItem(owned: number, level: number): boolean {
  return owned >= itemAscensionCap(level)
}

/**
 * Redémarrer one item: resets its *level* down to a small floor (RI resets its own circles to
 * level 5 on ascending, not 0) and grants one more permanent ascension level — its accumulated
 * multiplier is untouched, so unlike the previous (additive-production) version of this
 * mechanic, ascending never drops current production; it only resets how fast that item's
 * multiplier grows from here until it's re-leveled.
 */
export function performAscendItem(state: GameState, genId: GeneratorId): GameState {
  const level = state.ascensionLevels[genId]
  if (!canAscendItem(state.owned[genId], level)) return state
  return {
    ...state,
    owned: { ...state.owned, [genId]: ITEM_ASCENSION_RESET_LEVEL },
    ascensionLevels: { ...state.ascensionLevels, [genId]: level + 1 },
  }
}

/**
 * Grand ménage: pays Cave units, resets every item's level and ascension level (their
 * multipliers are untouched, same reasoning as per-item ascension above), cheapens Cadence.
 */
export function performGrandMenage(state: GameState): GameState {
  const cost = grandMenageCost(state.grandsMenages)
  if (state.owned[LAST_GENERATOR_ID] < cost) return state
  const owned = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>
  const ascensionLevels = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>
  return { ...state, owned, ascensionLevels, grandsMenages: state.grandsMenages + 1 }
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
 * Item multipliers grow linearly over the interval (level/ascension don't change while away), so
 * the average of the rate at the start and the end of the interval is an exact* trapezoid
 * approximation of the true (slightly convex) accumulated puanteur — good enough for an offline
 * catch-up that's capped at a few hours anyway.
 */
export function applyElapsedProduction(state: GameState, seconds: number): { state: GameState; gained: number } {
  const mult = computeMultipliers(state.axisMultipliers, state.cadenceLevel, 0.5)
  const rateStart = productionPerSecond(state.itemMultipliers, mult)
  const itemMultipliers = tickItemMultipliers(state.itemMultipliers, state.owned, state.ascensionLevels, seconds)
  const rateEnd = productionPerSecond(itemMultipliers, mult)
  const gained = ((rateStart + rateEnd) / 2) * seconds
  return {
    state: {
      ...state,
      itemMultipliers,
      puanteur: state.puanteur + gained,
      earnedSinceReset: state.earnedSinceReset + gained,
      bestCycleEarned: Math.max(state.bestCycleEarned, state.earnedSinceReset + gained),
      lastTickAt: Date.now(),
    },
    gained,
  }
}
