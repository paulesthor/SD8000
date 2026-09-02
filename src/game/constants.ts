import type { AxisDef, GeneratorDef } from './types'

// Relative growth-rate weighting between items — later (pricier) items grow their own
// multiplier faster once bought, same spirit as the old baseProduction weighting, just applied
// to a growth *rate* instead of a direct output. Absolute pacing is governed by
// ITEM_MULT_GROWTH_SCALE and PRODUCTION_EXPONENT in the item-multiplier block below, tuned by
// simulation against the real engine rather than this per-item ratio.
export const GENERATORS: GeneratorDef[] = [
  { id: 'pc', name: 'PC pourri', baseCost: 10, costGrowth: 1.14, scaling: 1.55, growthRate: 0.2 },
  { id: 'clavier', name: 'Clavier plein de miettes', baseCost: 60, costGrowth: 1.15, scaling: 1.6, growthRate: 1.2 },
  { id: 'chaussettes', name: 'Chaussettes du développeur', baseCost: 400, costGrowth: 1.16, scaling: 1.65, growthRate: 7 },
  { id: 'mug', name: 'Mug de café périmé', baseCost: 2800, costGrowth: 1.17, scaling: 1.7, growthRate: 42 },
  { id: 'routeur', name: 'Routeur wifi qui rame', baseCost: 20000, costGrowth: 1.18, scaling: 1.75, growthRate: 260 },
  { id: 'poubelle', name: 'Poubelle de la salle info', baseCost: 150000, costGrowth: 1.19, scaling: 1.8, growthRate: 1600 },
  { id: 'serveur', name: 'Serveur qui chauffe dans un placard', baseCost: 1200000, costGrowth: 1.2, scaling: 1.85, growthRate: 10000 },
  { id: 'cave', name: 'Cave / datacenter officieux', baseCost: 10000000, costGrowth: 1.21, scaling: 1.9, growthRate: 65000 },
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
// Items (each with its own per-item ascension) -> Grand ménage -> Redoublement, each level
// resetting the one(s) below it but leaving a permanent-for-the-cycle bonus behind — the item
// ascension replaces what was originally a global, AD-Dimension-Boost-style Redémarrage; the
// overall shape (Items -> boost -> galaxy -> Infinity) still mirrors AD's own
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
 * Item multiplier (RI's "circles"): puanteur/sec is no longer a sum of what each item produces —
 * each item just holds its own multiplier (itemMultipliers in GameState), starting at 1 and only
 * ever growing, a little every tick, faster the higher that item's level. Total production is
 * the *product* of all 8 of these, raised to PRODUCTION_EXPONENT to keep 8 compounding
 * multipliers from exploding uncontrollably, times the usual axis/cadence multipliers.
 *
 * First simulation pass showed unowned items visibly growing their own multiplier anyway (the
 * fresh-game screen showed "Mug de café périmé x3.44" before a single unit was ever bought) —
 * the per-item growthRate weight above is large for late items by design, and the rate formula
 * had dropped the `owned` factor the old additive-production version always multiplied by, so
 * that weight alone drove growth regardless of investment. Restored `owned` as a linear factor
 * (owned=0 now means exactly 0 growth, same as it meant 0 production before) and rescaled
 * ITEM_MULT_GROWTH_SCALE and PRODUCTION_EXPONENT afterward to land back on RI's 70-100min
 * benchmark: near-optimal play (buy everything affordable, ascend/grand-ménage/cadence as soon
 * as worthwhile) reaches couche 2 at ~93min, a more aggressive strategy at ~84min, both inside
 * the window; stable over 24h simulated, no NaN/Infinity.
 */
export const ITEM_MULT_GROWTH_SCALE = 0.1
export const PRODUCTION_EXPONENT = 0.245
/** How many "nats" of combined ln(mult) growth it takes for the exponent to decay toward the floor. */
export const PRODUCTION_EXPONENT_DECAY = 6

/**
 * Per-item ascension (replaces the old global Redémarrage/Dimension Boost — retour utilisateur :
 * un bouton par ligne d'item plutôt qu'un mécanisme global). Modeled on Revolution Idle's own
 * circle-ascension mechanic after checking their wiki, rather than guessing: RI does NOT reset a
 * circle's accumulated multiplier — ascending "resets a circle to level 5 [...] and raises its
 * level cap by 10". Now that items are RI-style circles (multiplier above, never reset by
 * ascending — only *level* resets, which only controls growth *speed*), redémarrer an item can
 * no longer crater its production the way it did when level directly drove output: the
 * multiplier it already earned stays exactly where it was, only how fast it grows next resets to
 * a small floor (ITEM_ASCENSION_RESET_LEVEL, matching RI's own "5" rather than the ITEM_ASCENSION
 * _RESET_FRACTION hack from the previous (additive-production) version of this mechanic, which is
 * no longer needed. The cap itself still grows every ascension (ITEM_ASCENSION_CAP_GROWTH per
 * level) so each successive ascension is a genuinely bigger undertaking, RI's own pacing lever.
 */
export const ITEM_ASCENSION_CAP = 100
export const ITEM_ASCENSION_CAP_GROWTH = 50
export const ITEM_ASCENSION_RESET_LEVEL = 5
export const ITEM_ASCENSION_BOOST = 4
/**
 * Much lower than the additive-production version of this mechanic used (1.2, itself raised from
 * 0.05): retour utilisateur — a level going from a few billion to 5 sextillion right after one
 * ascension. That harsh a penalty existed to stop "instant rebuy" from undoing a production
 * crater that no longer exists in the circle model (ascending doesn't touch the item's
 * multiplier at all anymore, only its level/growth-speed) — so the whole reason for a steep
 * penalty is gone. What's left to pace is successive ascensions getting too easy to spam, which
 * ITEM_ASCENSION_CAP_GROWTH above already handles on its own.
 */
export const ITEM_ASCENSION_COST_PENALTY = 0.1

/**
 * Grand ménage (AD's Antimatter Galaxy): costs units of Cave, resets every item's level,
 * ascension level, AND current puanteur to 0 (multipliers are untouched, same reasoning as
 * per-item ascension above), but makes Cadence purchases cheaper for the rest of this cycle (AD:
 * galaxies cheapen tickspeed). The bigger, rarer reset in the stack.
 *
 * The puanteur reset was missing in an earlier version — retour utilisateur: without it, doing a
 * grand ménage cost nothing real, since whatever puanteur you were still holding survived the
 * reset and could instantly rebuy back most of what was just wiped. AD's own galaxies reset
 * antimatter itself alongside dimensions and dimension boosts — same idea here.
 *
 * BASE_COST lowered 80 -> 35 after a QA pass simulating many strategies against the real engine
 * found the mechanic was dead: Cave (the priciest item) never exceeded ~69 owned in 2h of
 * near-optimal play before redoublement reset it again, so the 80 threshold was simply
 * unreachable — grandsMenages stayed at 0 in every scenario tested except one that never
 * redoubled at all. Re-verified with the same simulation: reachable within a normal cycle now.
 */
export const GRAND_MENAGE_BASE_COST = 35
export const GRAND_MENAGE_COST_STEP = 25
/** Each grand ménage divides future Cadence cost by (1 + grandsMenages * this). */
export const GRAND_MENAGE_CADENCE_DISCOUNT = 0.35

/**
 * Cadence (AD's tickspeed): bought directly with puanteur, survives per-item Redémarrage/Grand
 * ménage (only wiped by redoublement itself, like AD's tickspeed upgrades survive galaxies). Each level
 * is a flat permanent production multiplier — the "the game runs faster" lever.
 *
 * COST_GROWTH bumped 1.35 -> 6: retour utilisateur — la cadence coûtait bien trop peu pour ce
 * qu'elle rapportait et se spammait en quelques secondes avec le surplus de puanteur qui
 * n'avait de toute façon nulle part où aller. Vérifié avec le vrai moteur : avec 1.35, acheter
 * tout le surplus disponible à chaque tick atteignait le niveau 20 (x6 de production) en 60s et
 * le niveau 68 (x18) en 10 minutes — un bonus quasiment gratuit. Avec 6, le niveau 3 (x1.75) à
 * 60s et le niveau 10 (x3.5) à 10 minutes — un vrai choix coût/bénéfice à chaque achat plutôt
 * qu'un réflexe automatique.
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
// Bumped 300 -> 2e7: with the AD dimension-tier stack, buying-max compounds so fast that 300
// puanteur (the old value) was reachable in ~14s with only 5-6 of the cheapest item — the very
// first redoublement should feel like a real early milestone, not something a handful of PCs
// pourris hands you before the tutorial's over. Verified via the real engine: buying everything
// affordable each tick now takes ~150s (2.5min) to first cross this threshold; a lazier
// PC-pourri-only strategy takes ~20min — both a real "slow start" instead of instant.
export const REDOUBLEMENT_BASE_THRESHOLD = 2e7
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
 * Infinity, via *optimized* play, not casual play) — re-simulated with the real engine after
 * every balance pass since (see REDOUBLEMENT_BASE_THRESHOLD's comment for the first, Cadence's
 * for the biggest, PRODUCTION_EXPONENT's for the switch to RI's own circles/product model, and
 * productionPerSecond's own comment for the two exponent-smoothing fixes since — first the
 * discrete active-item count, then the discrete count itself replaced by a continuous decay
 * after it turned out to cause real production *drops* on buying a new item). Re-bumped once
 * more for the continuous-decay version, landing back on ~80min (2.2e17 measured), stable, no
 * NaN/Infinity.
 */
export const COUCHE_2_UNLOCK_THRESHOLD = 2.2e17

/** Offline progress is capped so a first prototype can't be abused by leaving it running for weeks. */
export const MAX_OFFLINE_SECONDS = 12 * 3600

// Bumped to v6: items switched from directly producing puanteur to RI's "circles" model (each
// item just holds a growing multiplier, puanteur/sec is the product of all of them) — a
// completely different meaning for `owned`/production, old saves' numbers wouldn't translate.
export const SAVE_KEY = 'sd8000-save-v6'
export const AUTOSAVE_INTERVAL_MS = 10_000
export const TICK_MS = 100
