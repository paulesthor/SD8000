import { MAX_OFFLINE_SECONDS, SAVE_KEY } from './constants'
import { createInitialState } from './engine'
import type { GameState } from './types'

export function loadState(): { state: GameState; offlineSeconds: number } {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) {
    return { state: createInitialState(), offlineSeconds: 0 }
  }
  try {
    const parsed = JSON.parse(raw) as GameState
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
