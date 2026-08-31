import { AXES, GENERATORS, MAX_OFFLINE_SECONDS, SAVE_KEY } from './constants'
import { createInitialState } from './engine'
import type { AxisId, GameState, GeneratorId } from './types'

/** Fills in fields added after a save was written, so older saves don't crash on load. */
function migrate(parsed: GameState): GameState {
  if (!parsed.ascensionLevels) {
    parsed.ascensionLevels = Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<
      GeneratorId,
      number
    >
  }
  if (!parsed.axisMultipliers) {
    parsed.axisMultipliers = Object.fromEntries(AXES.map((a) => [a.id, 1])) as Record<AxisId, number>
  }
  return parsed
}

export function loadState(): { state: GameState; offlineSeconds: number } {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) {
    return { state: createInitialState(), offlineSeconds: 0 }
  }
  try {
    const parsed = migrate(JSON.parse(raw) as GameState)
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
