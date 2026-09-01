import type { AxisDef, GeneratorDef } from './types'

// Pacing target (RI/AD-style): the very first purchase should be affordable in ~15s of idle
// production, not minutes — hence EARLY_GAME_SPEED scaling up every baseProduction below.
const EARLY_GAME_SPEED = 20

export const GENERATORS: GeneratorDef[] = [
  { id: 'pc', name: 'PC pourri', baseCost: 10, costGrowth: 1.14, scaling: 1.55, baseProduction: 0.2 * EARLY_GAME_SPEED },
  { id: 'clavier', name: 'Clavier plein de miettes', baseCost: 60, costGrowth: 1.15, scaling: 1.6, baseProduction: 1.2 * EARLY_GAME_SPEED },
  { id: 'chaussettes', name: 'Chaussettes du développeur', baseCost: 400, costGrowth: 1.16, scaling: 1.65, baseProduction: 7 * EARLY_GAME_SPEED },
  { id: 'mug', name: 'Mug de café périmé', baseCost: 2800, costGrowth: 1.17, scaling: 1.7, baseProduction: 42 * EARLY_GAME_SPEED },
  { id: 'routeur', name: 'Routeur wifi qui rame', baseCost: 20000, costGrowth: 1.18, scaling: 1.75, baseProduction: 260 * EARLY_GAME_SPEED },
  { id: 'poubelle', name: 'Poubelle de la salle info', baseCost: 150000, costGrowth: 1.19, scaling: 1.8, baseProduction: 1600 * EARLY_GAME_SPEED },
  { id: 'serveur', name: 'Serveur qui chauffe dans un placard', baseCost: 1200000, costGrowth: 1.2, scaling: 1.85, baseProduction: 10000 * EARLY_GAME_SPEED },
  { id: 'cave', name: 'Cave / datacenter officieux', baseCost: 10000000, costGrowth: 1.21, scaling: 1.9, baseProduction: 65000 * EARLY_GAME_SPEED },
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

// AD-style dimension/boost/galaxy stack, reskinned. Nested inside a single redoublement cycle:
// Items -> Redémarrage -> Grand ménage -> Redoublement, each level resetting the one(s) below it
// but leaving a permanent-for-the-cycle bonus behind, same shape as AD's
// Dimensions -> Dimension Boost -> Antimatter Galaxy -> Infinity.
//
// We reuse AD's real formulas' *shape* (stepped x2 production per 10 owned, cost that itself
// jumps every 10 owned, a boost that resets everything below it for a cascading multiplier, a
// galaxy-equivalent that resets further but cheapens a tickspeed-equivalent) — not its literal
// constants, which are tuned for AD's endgame scale (up to 1e308) and would be meaningless here
// where couche 2 unlocks at 1e13. These are recalibrated and verified by simulation instead
// (see the tsx-based real-engine sim referenced in the redoublement threshold comment below).

/** Every `DIMENSION_TIER_SIZE` owned, an item's production multiplier doubles (AD: dims double per 10). */
export const DIMENSION_TIER_SIZE = 10
export const DIMENSION_TIER_MULT = 2

/**
 * Redémarrage (AD's Dimension Boost): costs units of the last item (Cave), resets items 1-7
 * (everything but Cave) to 0, and grants a cascading multiplier — item 1 gets
 * DIMENSION_TIER_MULT^redemarrages, item 2 gets one power less, down to a floor of x1 — exactly
 * AD's "x2 to dimension 1, halved each dimension after, min x1" boost effect.
 */
export const REDEMARRAGE_BASE_COST = 20
export const REDEMARRAGE_COST_STEP = 15

/**
 * Grand ménage (AD's Antimatter Galaxy): costs units of Cave, resets every item AND redemarrages
 * to 0, but makes Cadence purchases cheaper for the rest of this cycle (AD: galaxies cheapen
 * tickspeed). The bigger, rarer reset in the stack.
 */
export const GRAND_MENAGE_BASE_COST = 80
export const GRAND_MENAGE_COST_STEP = 60
/** Each grand ménage divides future Cadence cost by (1 + grandsMenages * this). */
export const GRAND_MENAGE_CADENCE_DISCOUNT = 0.35

/**
 * Cadence (AD's tickspeed): bought directly with puanteur, survives Redémarrage/Grand ménage
 * (only wiped by redoublement itself, like AD's tickspeed upgrades survive galaxies). Each level
 * is a flat permanent production multiplier — the "the game runs faster" lever.
 */
export const CADENCE_BASE_COST = 50
export const CADENCE_COST_GROWTH = 1.35
export const CADENCE_EFFECT_PER_LEVEL = 0.25

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
/**
 * Gain is REDOUBLEMENT_LOG_SCALE * ln(earnedSinceReset / threshold) — a logarithmic curve
 * instead of a capped power curve. Two earlier versions of this formula both got this wrong:
 * a plain power curve (earned/threshold)^exponent let "wait way past the minimum" strategies
 * wildly outpace patient ones (waiting 30x the threshold unlocked couche 2 in ~4 minutes versus
 * ~2 hours for waiting 3x); adding a hard ratio cap fixed the runaway but replaced it with a
 * flat ceiling — once a player was far enough past the cap (trivial after any real offline
 * catch-up), the displayed gain froze at the exact same number forever, reading as broken.
 *
 * A log curve does neither: ln(1) = 0, so reaching just the threshold still gives nothing
 * (spamming redoublement the instant it unlocks stays worthless) and gain keeps climbing forever
 * past that — never a hard wall — but each further multiple of accumulation only adds a fixed
 * increment (doubling the surplus adds ln(2) ≈ 0.69, not a doubling of the gain itself), which
 * is what keeps the curve "easy at first, increasingly demanding" without ever fully stalling.
 * It's also inherently safe: simulated up to 24h of continuous aggressive play at several scales
 * without ever approaching numeric overflow, because compounding a *linearly*-growing gain
 * (ln of an exponentially growing ratio is linear) can't diverge the way a power-law gain does.
 */
export const REDOUBLEMENT_LOG_SCALE = 0.15

/**
 * Floor for the "Réduction de coûts" axis's cost multiplier — without it, that axis alone
 * creates its own unbounded loop (cheaper generators -> more owned -> more earned -> bigger
 * next redoublement gain -> even cheaper generators). Generators can get at most 50x cheaper
 * from this axis, never approach free.
 */
export const COST_MULT_FLOOR = 0.02

/**
 * Safety ceiling on any single axis multiplier — pure defense in depth. The log-based gain
 * formula above is inherently safe (simulated 24h+ of continuous aggressive play without
 * approaching overflow), so this should never actually bind; it just guarantees redoublement
 * gains simply stop applying rather than the game silently breaking if that's ever wrong.
 */
export const AXIS_MULT_SAFETY_CAP = 1e50

/**
 * bestCycleEarned needed to unlock couche 2 (Passage d'année) — RI's own Infinity unlocks the
 * same way: at 1.79e308 *Score*, which persists through the smaller Prestige/Promotion resets
 * but is the current run's peak, not a lifetime sum across many of them.
 *
 * Calibrated against RI's own published benchmark (70-100 minutes for a new player's first
 * Infinity, via *optimized* play, not casual play). Re-simulated with the full AD-style stack
 * (dimension tier doubling, Redémarrage cascade, Grand ménage, Cadence) via the real engine:
 * a near-optimal strategy (buy max every generator, redémarrer/faire le ménage/monter la cadence
 * as soon as affordable, redoubler once comfortably past threshold) reaches 1.16e18
 * bestCycleEarned at ~80 minutes. Casual play (patient x3, ignoring the meta mechanics
 * entirely) is still at ~2.3e13 by that same mark — many hours behind — so the benchmark still
 * assumes good play, same as RI's own guide.
 */
export const COUCHE_2_UNLOCK_THRESHOLD = 1.2e18

/** Offline progress is capped so a first prototype can't be abused by leaving it running for weeks. */
export const MAX_OFFLINE_SECONDS = 12 * 3600

// Bumped to v5: the AD dimension/boost/galaxy rework below replaces the whole item production
// and ascension model (per-item ascension removed entirely, replaced by the global
// Redémarrage/Grand ménage stack) — old saves' numbers wouldn't mean the same thing anymore.
export const SAVE_KEY = 'sd8000-save-v5'
export const AUTOSAVE_INTERVAL_MS = 10_000
export const TICK_MS = 100
