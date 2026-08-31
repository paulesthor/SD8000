import type { AxisDef, GeneratorDef } from './types'

// Pacing target (RI/AD-style): the very first purchase should be affordable in ~15s of idle
// production, not minutes — hence EARLY_GAME_SPEED scaling up every baseProduction below.
const EARLY_GAME_SPEED = 20

export const GENERATORS: GeneratorDef[] = [
  { id: 'pc', name: 'PC pourri', baseCost: 10, costGrowth: 1.14, baseProduction: 0.2 * EARLY_GAME_SPEED },
  { id: 'clavier', name: 'Clavier plein de miettes', baseCost: 60, costGrowth: 1.15, baseProduction: 1.2 * EARLY_GAME_SPEED },
  { id: 'chaussettes', name: 'Chaussettes du développeur', baseCost: 400, costGrowth: 1.16, baseProduction: 7 * EARLY_GAME_SPEED },
  { id: 'mug', name: 'Mug de café périmé', baseCost: 2800, costGrowth: 1.17, baseProduction: 42 * EARLY_GAME_SPEED },
  { id: 'routeur', name: 'Routeur wifi qui rame', baseCost: 20000, costGrowth: 1.18, baseProduction: 260 * EARLY_GAME_SPEED },
  { id: 'poubelle', name: 'Poubelle de la salle info', baseCost: 150000, costGrowth: 1.19, baseProduction: 1600 * EARLY_GAME_SPEED },
  { id: 'serveur', name: 'Serveur qui chauffe dans un placard', baseCost: 1200000, costGrowth: 1.2, baseProduction: 10000 * EARLY_GAME_SPEED },
  { id: 'cave', name: 'Cave / datacenter officieux', baseCost: 10000000, costGrowth: 1.21, baseProduction: 65000 * EARLY_GAME_SPEED },
]

export const AXES: AxisDef[] = [
  {
    id: 'vitesse',
    name: 'Vitesse de production',
    description: 'Multiplie directement la production.',
  },
  {
    id: 'production',
    name: 'Production globale',
    description: 'Multiplie directement la production (échelle indépendante de Vitesse).',
  },
  {
    id: 'cout',
    name: 'Réduction de coûts',
    description: 'Divise le coût des générateurs.',
  },
  {
    id: 'instabilite',
    name: 'Instabilité',
    description: 'Gros bonus de production, mais la production fluctue aléatoirement.',
  },
  {
    id: 'synergie',
    name: 'Synergie',
    description: "Multiplie la production selon combien tu as fait grandir tes autres axes.",
  },
]

/** Owned units needed to ascend a generator at level 0; grows by ASCENSION_THRESHOLD_GROWTH per level. */
export const ASCENSION_BASE_THRESHOLD = 50
export const ASCENSION_THRESHOLD_GROWTH = 1.6
/** Permanent per-unit production multiplier per ascension level (compounds). */
export const ASCENSION_PRODUCTION_GROWTH = 1.7
/** Extra cost-growth penalty applied per ascension level — makes refilling slower each time. */
export const ASCENSION_COST_GROWTH_PENALTY = 0.05

// RI-style redoublement: no currency, no shop. Redoubling grants a multiplier — computed from
// puanteur earned this run, rendements décroissants — applied directly to whichever axis the
// player picks. Tuned so the multiplier gain scales ~+50% for each doubling of earned puanteur,
// the "reset when the next gain is roughly 50-100% more than what you have" heuristic idle
// games converge on, instead of a hard wall where redoubling suddenly becomes worth it.
export const REDOUBLEMENT_MIN_EARNED = 300
export const REDOUBLEMENT_DIVISOR = 300
export const REDOUBLEMENT_EXPONENT = 0.6
/** Scales the raw (earned/divisor)^exponent value into an axis multiplier bonus. */
export const REDOUBLEMENT_MULT_SCALE = 0.1

/** Offline progress is capped so a first prototype can't be abused by leaving it running for weeks. */
export const MAX_OFFLINE_SECONDS = 12 * 3600

// Bumped to v2: the redoublement economy changed shape (PR currency/shop removed in favor of
// direct per-axis multipliers), so old saves aren't meaningfully convertible — start fresh.
export const SAVE_KEY = 'sd8000-save-v2'
export const AUTOSAVE_INTERVAL_MS = 10_000
export const TICK_MS = 100
