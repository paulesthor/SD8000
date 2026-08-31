import type { AxisDef, GeneratorDef } from './types'

export const GENERATORS: GeneratorDef[] = [
  { id: 'pc', name: 'PC pourri', baseCost: 10, costGrowth: 1.14, baseProduction: 0.2 },
  { id: 'clavier', name: 'Clavier plein de miettes', baseCost: 60, costGrowth: 1.15, baseProduction: 1.2 },
  { id: 'chaussettes', name: 'Chaussettes du développeur', baseCost: 400, costGrowth: 1.16, baseProduction: 7 },
  { id: 'mug', name: 'Mug de café périmé', baseCost: 2800, costGrowth: 1.17, baseProduction: 42 },
  { id: 'routeur', name: 'Routeur wifi qui rame', baseCost: 20000, costGrowth: 1.18, baseProduction: 260 },
  { id: 'poubelle', name: 'Poubelle de la salle info', baseCost: 150000, costGrowth: 1.19, baseProduction: 1600 },
  { id: 'serveur', name: 'Serveur qui chauffe dans un placard', baseCost: 1200000, costGrowth: 1.2, baseProduction: 10000 },
  { id: 'cave', name: 'Cave / datacenter officieux', baseCost: 10000000, costGrowth: 1.21, baseProduction: 65000 },
]

export const AXES: AxisDef[] = [
  {
    id: 'vitesse',
    name: 'Vitesse de production',
    description: '+10% de production par niveau.',
    baseCost: 1,
    costGrowth: 1.35,
  },
  {
    id: 'production',
    name: 'Production globale',
    description: '+25% de production par niveau (plus cher que Vitesse).',
    baseCost: 2,
    costGrowth: 1.45,
  },
  {
    id: 'cout',
    name: 'Réduction de coûts',
    description: '-3% de coût des générateurs par niveau.',
    baseCost: 1,
    costGrowth: 1.3,
  },
  {
    id: 'instabilite',
    name: 'Instabilité',
    description: '+40% de production par niveau, mais la production fluctue aléatoirement.',
    baseCost: 3,
    costGrowth: 1.5,
  },
  {
    id: 'synergie',
    name: 'Synergie',
    description: 'Multiplie la production selon le niveau cumulé de tes autres axes.',
    baseCost: 5,
    costGrowth: 1.6,
  },
]

/** Owned units needed to ascend a generator at level 0; grows by ASCENSION_THRESHOLD_GROWTH per level. */
export const ASCENSION_BASE_THRESHOLD = 50
export const ASCENSION_THRESHOLD_GROWTH = 1.6
/** Permanent per-unit production multiplier per ascension level (compounds). */
export const ASCENSION_PRODUCTION_GROWTH = 1.7
/** Extra cost-growth penalty applied per ascension level — makes refilling slower each time. */
export const ASCENSION_COST_GROWTH_PENALTY = 0.05

/** Offline progress is capped so a first prototype can't be abused by leaving it running for weeks. */
export const MAX_OFFLINE_SECONDS = 12 * 3600

export const SAVE_KEY = 'sd8000-save-v1'
export const AUTOSAVE_INTERVAL_MS = 10_000
export const TICK_MS = 100
