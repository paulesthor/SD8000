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

/**
 * AD/RI-style tier cascade: each generator's production is boosted by how many of the *next*
 * tier up you own (e.g. Clavier boosts PC pourri, Chaussettes boosts Clavier, ...). The last
 * tier (Cave) has nothing above it, so it only benefits from axes/ascension like before.
 */
export const TIER_BOOST_COEFF = 0.02

/** Owned units needed to ascend a generator at level 0; grows by ASCENSION_THRESHOLD_GROWTH per level. */
export const ASCENSION_BASE_THRESHOLD = 50
export const ASCENSION_THRESHOLD_GROWTH = 1.6
/** Permanent per-unit production multiplier per ascension level (compounds). */
export const ASCENSION_PRODUCTION_GROWTH = 1.7
/** Extra cost-growth penalty applied per ascension level — makes refilling slower each time. */
export const ASCENSION_COST_GROWTH_PENALTY = 0.05

// RI-style redoublement: no currency, no shop. Redoubling grants a multiplier — computed from
// puanteur earned this run relative to a threshold, rendements décroissants — applied directly
// to whichever axis the player picks.
//
// The threshold rising with every redoublement already done is what keeps this from spiraling:
// without it, a stronger axis multiplier -> faster production -> the (fixed) threshold reached
// in less real time -> another axis bump -> even faster production, an unbounded positive
// feedback loop that hit numeric infinity within seconds. Gating the threshold on redoublement
// count means getting the *next* bump always takes more effort than the last, however strong
// you've become — the standard way incremental games keep a prestige-into-itself loop from
// diverging.
//
// The per-step growth rate itself isn't constant — it decays from
// REDOUBLEMENT_THRESHOLD_GROWTH_MAX down toward REDOUBLEMENT_THRESHOLD_GROWTH_MIN as
// redoublements pile up (REDOUBLEMENT_THRESHOLD_DECAY controls how fast, in redoublements —
// large so the transition spans hours, not minutes). Early redoublements each need several
// times more puanteur than the last (slow, deliberate pacing); later ones need proportionally
// less, so compounding axis bonuses visibly outrun the threshold and the game snowballs — the
// requested "slow then speeds up" shape. GROWTH_MIN stays well above 1 (not close to it) so
// that snowball never turns into the unbounded loop this game hit twice before: simulated up
// to 24h of continuous "patient" play without ever approaching numeric overflow.
export const REDOUBLEMENT_BASE_THRESHOLD = 300
export const REDOUBLEMENT_THRESHOLD_GROWTH_MAX = 6
export const REDOUBLEMENT_THRESHOLD_GROWTH_MIN = 1.5
export const REDOUBLEMENT_THRESHOLD_DECAY = 60
// Tuned low (0.35, was 0.5): a higher exponent let "wait way past the minimum" strategies
// wildly outpace "reasonably patient" ones — simulated, waiting 30x the threshold every time
// unlocked couche 2 in ~4 minutes versus ~2 hours for waiting 3x, a 100x+ spread that made the
// threshold below impossible to calibrate meaningfully. At 0.35 the same two strategies land
// within a much narrower band of each other.
export const REDOUBLEMENT_EXPONENT = 0.35
/**
 * Scales (earned/threshold)^exponent - 1 into an axis multiplier bonus. The "- 1" is what
 * makes this scale on *accumulation beyond the minimum*, not merely reaching it: redoubling
 * the instant earnedSinceReset crosses the threshold gives exactly 0% — spamming redoublement
 * the moment it unlocks is worthless. Waiting and accumulating well past the threshold is what
 * pays off (e.g. earning 4x the threshold before redoubling is worth vastly more than earning
 * just barely over it).
 */
export const REDOUBLEMENT_MULT_SCALE = 0.5
/**
 * Caps the earned/threshold ratio the gain formula sees. Without this, waiting arbitrarily long
 * before redoubling gives an arbitrarily large gain, which — compounded over enough
 * redoublements — is what caused this game's last two numeric-overflow bugs. Capped, the gain
 * from a single redoublement is bounded no matter how long you wait, so growth over many
 * redoublements stays a controlled geometric series instead of a diverging one.
 *
 * Tuned down from 50 to 8: at 50, waiting for a huge overshoot (e.g. 30x the threshold) was
 * still a live exploit even with the exponent above capped — every redoublement stayed near the
 * max achievable gain and the ratio cap barely mattered in practice. At 8, overshooting past
 * roughly 8x the threshold stops paying off at all, so there's a real "sweet spot" to aim for
 * instead of an incentive to wait indefinitely.
 */
export const REDOUBLEMENT_MAX_RATIO = 8

/**
 * Floor for the "Réduction de coûts" axis's cost multiplier — without it, that axis alone
 * creates its own unbounded loop (cheaper generators -> more owned -> more earned -> bigger
 * next redoublement gain -> even cheaper generators). Generators can get at most 50x cheaper
 * from this axis, never approach free.
 */
export const COST_MULT_FLOOR = 0.02

/**
 * Safety ceiling on any single axis multiplier — pure defense in depth. With
 * REDOUBLEMENT_MAX_RATIO and the rebalanced threshold curve above, growth stays sane even over
 * 24h+ of simulated continuous play (axis multipliers land around a few hundred, nowhere near
 * this), but this guarantees redoublement gains simply stop applying rather than the game
 * silently breaking if that's ever wrong.
 */
export const AXIS_MULT_SAFETY_CAP = 1e50

/**
 * bestCycleEarned needed to unlock couche 2 (Passage d'année) — RI's own Infinity unlocks the
 * same way: at 1.79e308 *Score*, which persists through the smaller Prestige/Promotion resets
 * but is the current run's peak, not a lifetime sum across many of them.
 *
 * Calibrated against RI's own published benchmark (70-100 minutes for a new player's first
 * Infinity, via *optimized* play — not casual). A naive first calibration against "patient x3"
 * (redouble at ~3x the minimum threshold) turned out not to be robust: an optimized player who
 * instead waits for close to the ratio cap (~8x) reached the same threshold in under 10 minutes,
 * a 10x+ discrepancy that made the number meaningless. 1e14 is calibrated against *that*
 * optimized strategy — reached at ~70-80 minutes in simulation — with casual play landing well
 * north of that, same as RI where the benchmark assumes good play, not idle clicking.
 */
export const COUCHE_2_UNLOCK_THRESHOLD = 1e14

/** Offline progress is capped so a first prototype can't be abused by leaving it running for weeks. */
export const MAX_OFFLINE_SECONDS = 12 * 3600

// Bumped to v4: full wipe requested — existing local saves were stuck holding Infinity from
// the pre-fix runaway bug, and Infinity poisons every further calculation it touches, so no
// migration could recover them. Also coincides with the tier-boost generator rework below.
export const SAVE_KEY = 'sd8000-save-v4'
export const AUTOSAVE_INTERVAL_MS = 10_000
export const TICK_MS = 100
