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
  REDOUBLEMENT_BASE_THRESHOLD,
  REDOUBLEMENT_LOG_SCALE,
  REDOUBLEMENT_THRESHOLD_DECAY,
  REDOUBLEMENT_THRESHOLD_GROWTH_MAX,
  REDOUBLEMENT_THRESHOLD_GROWTH_MIN,
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

/** AD-style stepped production multiplier: doubles every full decade owned (10, 20, 30...). */
export function dimensionTierMultiplier(owned: number): number {
  return Math.pow(DIMENSION_TIER_MULT, Math.floor(owned / DIMENSION_TIER_SIZE))
}

/** Permanent per-item production multiplier from that item's own ascension level. */
export function itemAscensionMultiplier(level: number): number {
  return Math.pow(ITEM_ASCENSION_BOOST, level)
}

/** Owned units needed to ascend this item again, given its current ascension level — grows every level. */
export function itemAscensionCap(level: number): number {
  return ITEM_ASCENSION_CAP + level * ITEM_ASCENSION_CAP_GROWTH
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
  const costGrowth = def.costGrowth * (1 + ITEM_ASCENSION_COST_PENALTY * ascLevel)
  let total = 0
  for (let i = 0; i < qty; i++) {
    const n = owned + i
    const decade = Math.floor(n / DIMENSION_TIER_SIZE)
    total += def.baseCost * Math.pow(costGrowth, n) * Math.pow(def.scaling, decade)
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

/**
 * Puanteur/sec (index 0) or units/sec of the tier below (index > 0) produced by a single item
 * right now — AD's real dimension chain: Clavier produces PC pourri, Chaussettes produces
 * Clavier, and so on down to PC pourri, which alone produces puanteur.
 */
export function generatorProductionPerSecond(
  index: number,
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  mult: Multipliers,
): number {
  const def = GENERATORS[index]
  const dimMult = dimensionTierMultiplier(owned[def.id])
  const ascMult = itemAscensionMultiplier(ascensionLevels[def.id])
  return def.baseProduction * owned[def.id] * dimMult * ascMult * mult.totalProductionMult
}

/** Puanteur/sec right now — PC pourri's own production, the bottom of the dimension chain. */
export function productionPerSecond(
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  mult: Multipliers,
): number {
  return generatorProductionPerSecond(0, owned, ascensionLevels, mult)
}

/**
 * Advances the whole chain by `seconds`: every item above PC pourri feeds owned[tier below] at
 * its current production rate, and PC pourri's own production is returned as puanteur gained.
 * Each item's contribution is clamped so owned never exceeds its ascension cap, whatever the
 * source (bought or produced) — same rule buying already respects.
 */
export function tickChain(
  owned: Record<GeneratorId, number>,
  ascensionLevels: Record<GeneratorId, number>,
  mult: Multipliers,
  seconds: number,
): { owned: Record<GeneratorId, number>; puanteurGained: number } {
  const next = { ...owned }
  let puanteurGained = 0
  for (let i = GENERATORS.length - 1; i >= 0; i--) {
    const produced = generatorProductionPerSecond(i, owned, ascensionLevels, mult) * seconds
    if (i === 0) {
      puanteurGained = produced
    } else {
      const targetId = GENERATORS[i - 1].id
      const cap = itemAscensionCap(ascensionLevels[targetId])
      next[targetId] = Math.min(cap, next[targetId] + produced)
    }
  }
  return { owned: next, puanteurGained }
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
 * Redémarrer one item: resets its owned count down to a small floor (RI resets its own circles
 * to level 5 on ascending, not 0) and grants one more permanent ascension level.
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
 * "Tout acheter au max" : achète le maximum abordable de chaque item (dans l'ordre de la chaîne,
 * PC pourri d'abord — acheter un item plus tôt dans la chaîne ne coûte jamais de la puanteur dont
 * un item plus tard aurait besoin, donc l'ordre ne change rien au total achetable), puis redémarre
 * tout item qui a atteint son cap d'ascension. Un seul passage : redémarrer un item ne libère pas
 * de puanteur pour en racheter un autre, donc pas besoin de boucler.
 */
export function performBuyAndAscendMax(state: GameState, mult: Multipliers): GameState {
  let puanteur = state.puanteur
  const owned = { ...state.owned }
  for (const def of GENERATORS) {
    const { qty, cost } = maxAffordable(def.id, owned[def.id], puanteur, mult.costMult, state.ascensionLevels[def.id])
    if (qty > 0) {
      owned[def.id] += qty
      puanteur -= cost
    }
  }
  const ascensionLevels = { ...state.ascensionLevels }
  for (const def of GENERATORS) {
    if (canAscendItem(owned[def.id], ascensionLevels[def.id])) {
      ascensionLevels[def.id] += 1
      owned[def.id] = ITEM_ASCENSION_RESET_LEVEL
    }
  }
  return { ...state, puanteur, owned, ascensionLevels }
}

/**
 * Grand ménage: pays Cave units, resets every item's owned count, ascension level, AND current
 * puanteur to 0 (AD's galaxies reset antimatter itself too, not just dimensions), cheapens Cadence.
 */
export function performGrandMenage(state: GameState): GameState {
  const cost = grandMenageCost(state.grandsMenages)
  if (state.owned[LAST_GENERATOR_ID] < cost) return state
  const owned = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>
  // Same free starter as createInitialState: PC pourri is the only item producing puanteur
  // directly, so zeroing it alongside puanteur itself would strand the player at a permanent
  // 0-production, 0-puanteur dead end with no way to ever buy anything again.
  owned.pc = 1
  const ascensionLevels = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>
  return { ...state, owned, ascensionLevels, puanteur: 0, grandsMenages: state.grandsMenages + 1 }
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
 * currency, the redoublement itself is the reward, applied directly to one axis.
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
  const { owned, puanteurGained: gained } = tickChain(state.owned, state.ascensionLevels, mult, seconds)
  return {
    state: {
      ...state,
      owned,
      puanteur: state.puanteur + gained,
      earnedSinceReset: state.earnedSinceReset + gained,
      bestCycleEarned: Math.max(state.bestCycleEarned, state.earnedSinceReset + gained),
      lastTickAt: Date.now(),
    },
    gained,
  }
}
