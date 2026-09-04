import { AXES, AXIS_MULT_SAFETY_CAP, GENERATORS, ITEM_ASCENSION_CAP_SAFETY_CAP, MAX_OFFLINE_SECONDS, PUANTEUR_SAFETY_CAP, SAVE_KEY } from './constants'
import { createInitialState, itemAscensionCap } from './engine'
import type { AxisId, GameState, GeneratorId } from './types'

/**
 * Repairs a save corrupted by the pre-safety-cap numeric overflow bug: several hours of
 * continuous play without redoubling could push puanteur/production/axis multipliers past
 * Number.MAX_VALUE to Infinity — and `JSON.stringify(Infinity)` silently writes `null`, which
 * then coerces to 0 or NaN in later arithmetic depending on the operator, corrupting the whole
 * save in inconsistent ways (frozen production, buttons stuck disabled, etc — this is the exact
 * "j'ai cassé le jeu après ne pas avoir joué pendant quelques heures" bug). Restores each
 * corrupted field to its safety cap (the value it should have topped out at) rather than 0, so a
 * very advanced save recovers as "very advanced" instead of losing all progress.
 */
function sanitize(state: GameState): GameState {
  const isBadNumber = (v: unknown): v is number => typeof v !== 'number' || !Number.isFinite(v)

  if (isBadNumber(state.puanteur) || state.puanteur < 0) state.puanteur = PUANTEUR_SAFETY_CAP
  if (isBadNumber(state.earnedSinceReset) || state.earnedSinceReset < 0) state.earnedSinceReset = PUANTEUR_SAFETY_CAP
  if (isBadNumber(state.bestCycleEarned) || state.bestCycleEarned < 0) state.bestCycleEarned = PUANTEUR_SAFETY_CAP

  for (const def of GENERATORS) {
    if (isBadNumber(state.ascensionLevels[def.id]) || state.ascensionLevels[def.id] < 0) {
      state.ascensionLevels[def.id] = 0
    }
    const cap = itemAscensionCap(state.ascensionLevels[def.id])
    if (isBadNumber(state.owned[def.id]) || state.owned[def.id] < 0) {
      state.owned[def.id] = Math.min(cap, ITEM_ASCENSION_CAP_SAFETY_CAP)
    }
  }
  // PC pourri is the free starter everywhere else in the engine (createInitialState, Grand
  // ménage, redoublement) — never let a save leave it at 0, or the player is stuck producing
  // nothing with no way to buy anything (the exact deadlock fixed earlier for Grand ménage).
  state.owned.pc = Math.max(1, state.owned.pc)

  for (const a of AXES) {
    if (isBadNumber(state.axisMultipliers[a.id]) || state.axisMultipliers[a.id] < 1) {
      state.axisMultipliers[a.id] = AXIS_MULT_SAFETY_CAP
    }
    if (isBadNumber(state.axisFloors[a.id]) || state.axisFloors[a.id] < 0) state.axisFloors[a.id] = 0
  }

  if (isBadNumber(state.grandsMenages) || state.grandsMenages < 0) state.grandsMenages = 0
  if (isBadNumber(state.cadenceLevel) || state.cadenceLevel < 0) state.cadenceLevel = 0
  if (isBadNumber(state.redoublements) || state.redoublements < 0) state.redoublements = 0

  return state
}

/** Fills in fields added after a save was written, so older saves don't crash on load. */
function migrate(parsed: GameState): GameState {
  if (!parsed.axisMultipliers) {
    parsed.axisMultipliers = Object.fromEntries(AXES.map((a) => [a.id, 1])) as Record<AxisId, number>
  }
  if (!parsed.axisFloors) {
    parsed.axisFloors = Object.fromEntries(AXES.map((a) => [a.id, 0])) as Record<AxisId, number>
  }
  if (typeof parsed.bestCycleEarned !== 'number') {
    // lifetimeEarned was this field's previous name/shape (a lifetime sum, replaced because it
    // didn't match how RI's own Infinity gate works) — fall back sensibly either way.
    const legacy = (parsed as unknown as { lifetimeEarned?: number }).lifetimeEarned
    parsed.bestCycleEarned = legacy ?? parsed.earnedSinceReset ?? 0
  }
  // ascensionLevels replaces the old global `redemarrages` counter (per-item ascension instead
  // of a global Dimension-Boost-style reset) — a save with the old field just drops it silently.
  if (!parsed.ascensionLevels) {
    parsed.ascensionLevels = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<
      GeneratorId,
      number
    >
  }
  if (typeof parsed.grandsMenages !== 'number') parsed.grandsMenages = 0
  if (typeof parsed.cadenceLevel !== 'number') parsed.cadenceLevel = 0
  return parsed
}

export function loadState(): { state: GameState; offlineSeconds: number } {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) {
    return { state: createInitialState(), offlineSeconds: 0 }
  }
  try {
    const parsed = sanitize(migrate(JSON.parse(raw) as GameState))
    const elapsedSeconds = (Date.now() - parsed.lastTickAt) / 1000
    const offlineSeconds = Math.max(0, Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS))
    return { state: parsed, offlineSeconds }
  } catch {
    return { state: createInitialState(), offlineSeconds: 0 }
  }
}

export function saveState(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastTickAt: Date.now() }))
}

export function resetSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
