import type { AxisDef, GeneratorDef } from './types'

// AD's real dimension chain, reskinned: each item produces the item one tier below it (Clavier
// produces PC pourri, Chaussettes produces Clavier, ...), cascading down to PC pourri, the only
// item that produces puanteur directly. baseProduction here is "units of the tier below produced
// per owned unit per second" (or puanteur/sec for PC pourri) — kept deliberately small and only
// mildly increasing per tier: in a chain, this number compounds through every tier below it (an
// item's production feeds the next, which feeds the next...), so anything much bigger reaches
// each tier's ascension cap within a single tick, making "redémarrer" fire dozens of times a
// second instead of being a deliberate choice (see the ITEM_ASCENSION comment below — this was
// exactly the runaway found during the first balance pass on the chain model, confirmed by
// simulation: ~1500 ascensions in 5 minutes of "optimal" play. These values were originally the
// game's very first (pre-chain) direct-production numbers, sized for a completely different
// mechanic — they had to come down by ~1000x-40000x for the chain to feel like a chain instead of
// an instant flood).
export const GENERATORS: GeneratorDef[] = [
  { id: 'pc', name: 'PC pourri', baseCost: 10, costGrowth: 1.14, scaling: 1.55, baseProduction: 1 },
  { id: 'clavier', name: 'Clavier plein de miettes', baseCost: 60, costGrowth: 1.15, scaling: 1.6, baseProduction: 0.6 },
  { id: 'chaussettes', name: 'Chaussettes du développeur', baseCost: 400, costGrowth: 1.16, scaling: 1.65, baseProduction: 0.36 },
  { id: 'mug', name: 'Mug de café périmé', baseCost: 2800, costGrowth: 1.17, scaling: 1.7, baseProduction: 0.22 },
  { id: 'routeur', name: 'Routeur wifi qui rame', baseCost: 20000, costGrowth: 1.18, scaling: 1.75, baseProduction: 0.13 },
  { id: 'poubelle', name: 'Poubelle de la salle info', baseCost: 150000, costGrowth: 1.19, scaling: 1.8, baseProduction: 0.08 },
  { id: 'serveur', name: 'Serveur qui chauffe dans un placard', baseCost: 1200000, costGrowth: 1.2, scaling: 1.85, baseProduction: 0.05 },
  { id: 'cave', name: 'Cave / datacenter officieux', baseCost: 10000000, costGrowth: 1.21, scaling: 1.9, baseProduction: 0.03 },
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

// AD-style dimension/boost/galaxy stack, reskinned. Nested inside a single redoublement cycle:
// Items (each with its own per-item ascension, and each producing the item below it) -> Grand
// ménage -> Redoublement, each level resetting the one(s) below it but leaving a
// permanent-for-the-cycle bonus behind — the item ascension replaces what was originally a
// global, AD-Dimension-Boost-style Redémarrage; the overall shape (Items -> boost -> galaxy ->
// Infinity) still mirrors AD's own Dimensions -> Dimension Boost -> Antimatter Galaxy -> Infinity.

/** Every `DIMENSION_TIER_SIZE` owned, an item's own production rate doubles (AD: dims double per 10). */
export const DIMENSION_TIER_SIZE = 25
export const DIMENSION_TIER_MULT = 1.3
/** Hard ceiling on tier steps — without it, an exponentially-growing ascension cap (see below) would make this multiplier doubly exponential. */
export const DIMENSION_TIER_MAX_STEPS = 15

/**
 * Per-item ascension (replaces the old global Redémarrage/Dimension Boost — retour utilisateur :
 * un bouton par ligne d'item plutôt qu'un mécanisme global). Modeled on Revolution Idle's own
 * circle-ascension mechanic after checking their wiki: RI does NOT reset a circle all the way to
 * 0 — ascending "resets a circle to level 5 [...] and raises its level cap by 10". Applied here:
 * redémarrer resets an item's *owned* count down to ITEM_ASCENSION_RESET_LEVEL (not 0) in
 * exchange for a permanent production boost (ITEM_ASCENSION_BOOST^level), and the cap itself
 * grows *exponentially* with the level (ITEM_ASCENSION_CAP_GROWTH_RATE^level) so each successive
 * ascension is a genuinely bigger undertaking than the last.
 *
 * Rebalanced after the switch to the AD dimension-chain model: with a chain, every item's own
 * production feeds the next tier's owned count directly, so the old additive cap growth (+50 per
 * level) was a linear wall against boost/dimension multipliers that compound *exponentially* —
 * once an item ascended a few times, its own production refilled it to cap within a single tick,
 * making "redémarrer" fire dozens of times per second instead of being a deliberate choice
 * (confirmed by simulation: ~1500 ascensions in 5 minutes of optimal play). Making the cap grow
 * exponentially too, and toning down both the ascension boost and the dimension-tier bonus (which
 * compounds across all 8 chained items at once), breaks that runaway feedback loop.
 */
export const ITEM_ASCENSION_CAP = 100
export const ITEM_ASCENSION_CAP_GROWTH_RATE = 2.5
export const ITEM_ASCENSION_RESET_LEVEL = 5
export const ITEM_ASCENSION_BOOST = 2
export const ITEM_ASCENSION_COST_PENALTY = 0.1

/**
 * Grand ménage (AD's Antimatter Galaxy): costs units of Cave, resets every item's owned count,
 * ascension level, AND current puanteur to 0 (AD's galaxies reset antimatter itself alongside
 * dimensions and dimension boosts), but makes Cadence purchases cheaper for the rest of this
 * cycle (AD: galaxies cheapen tickspeed). The bigger, rarer reset in the stack.
 */
export const GRAND_MENAGE_BASE_COST = 35
export const GRAND_MENAGE_COST_STEP = 25
/** Each grand ménage divides future Cadence cost by (1 + grandsMenages * this). */
export const GRAND_MENAGE_CADENCE_DISCOUNT = 0.35

/**
 * Cadence (AD's tickspeed): bought directly with puanteur, survives per-item Redémarrage/Grand
 * ménage (only wiped by redoublement itself, like AD's tickspeed upgrades survive galaxies). Each
 * level is a flat permanent production multiplier — the "the game runs faster" lever.
 */
export const CADENCE_BASE_COST = 50
export const CADENCE_COST_GROWTH = 6
export const CADENCE_EFFECT_PER_LEVEL = 0.25

// RI-style redoublement: no currency, no shop. Redoubling grants a multiplier — computed from
// puanteur earned this run relative to a threshold, rendements décroissants — applied directly
// to whichever axis the player picks.
//
// The threshold rising with every redoublement already done is what keeps this from spiraling:
// without it, a stronger axis multiplier -> faster production -> the (fixed) threshold reached
// in less real time -> another axis bump -> even faster production, an unbounded positive
// feedback loop. Gating the threshold on redoublement count means getting the *next* bump always
// takes more effort than the last, however strong you've become — the standard way incremental
// games keep a prestige-into-itself loop from diverging.
//
// The per-step growth rate itself isn't constant — it decays from
// REDOUBLEMENT_THRESHOLD_GROWTH_MAX down toward REDOUBLEMENT_THRESHOLD_GROWTH_MIN as
// redoublements pile up (REDOUBLEMENT_THRESHOLD_DECAY controls how fast, in redoublements —
// large so the transition spans hours, not minutes): early redoublements each need several times
// more puanteur than the last (slow, deliberate pacing); later ones need proportionally less, so
// compounding axis bonuses visibly outrun the threshold and the game snowballs — "slow then
// speeds up". Retuned after the balance pass that shrank GENERATORS' baseProduction values by
// several orders of magnitude (see the comment above GENERATORS) — verified by simulation against
// the real engine: the previous 5e7 (tuned for the old, much faster economy) was no longer
// reachable within an hour of buy-everything play. 1.3e4 takes ~2.3min instead, same target as
// before the balance pass.
export const REDOUBLEMENT_BASE_THRESHOLD = 1.3e4
export const REDOUBLEMENT_THRESHOLD_GROWTH_MAX = 6
export const REDOUBLEMENT_THRESHOLD_GROWTH_MIN = 1.5
export const REDOUBLEMENT_THRESHOLD_DECAY = 60
/**
 * Gain is REDOUBLEMENT_LOG_SCALE * ln(earnedSinceReset / threshold) — a logarithmic curve: ln(1)
 * = 0, so reaching just the threshold still gives nothing (spamming redoublement the instant it
 * unlocks stays worthless) and gain keeps climbing forever past that — never a hard wall — but
 * each further multiple of accumulation only adds a fixed increment (doubling the surplus adds
 * ln(2) ≈ 0.69, not a doubling of the gain itself), which is what keeps the curve "easy at first,
 * increasingly demanding" without ever fully stalling. It's also inherently safe against numeric
 * overflow, because compounding a *linearly*-growing gain (ln of an exponentially growing ratio
 * is linear) can't diverge the way a power-law gain does.
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
 * Infinity, via *optimized* play, not casual play) — re-simulated with the real engine after
 * every balance pass, most recently the switch from RI's circles/product model back to AD's real
 * dimension-chain production (each item produces the one below it, cascading down to puanteur).
 */
export const COUCHE_2_UNLOCK_THRESHOLD = 2e31

/** Offline progress is capped so a first prototype can't be abused by leaving it running for weeks. */
export const MAX_OFFLINE_SECONDS = 12 * 3600

// Bumped to v7: switched from RI's circles/product model back to AD's real dimension-chain
// production (each item produces the item below it, cascading down to puanteur) — `owned`'s
// role changes completely again, old saves' numbers wouldn't translate.
export const SAVE_KEY = 'sd8000-save-v7'
export const AUTOSAVE_INTERVAL_MS = 10_000
export const TICK_MS = 100
