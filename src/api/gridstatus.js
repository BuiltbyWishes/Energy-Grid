const GS_KEY  = import.meta.env.VITE_GRIDSTATUS_API_KEY;
const GS_BASE = 'https://api.gridstatus.io/v1';

// ── EIA respondent ID → GridStatus ISO slug ──────────────────────
export const ISO_MAP = {
  CISO: 'caiso',
  ERCO: 'ercot',
  PJM:  'pjm',
  MISO: 'miso',
  SWPP: 'spp',
  NYIS: 'nyiso',
  ISNE: 'isone',
};

// Reverse map: slug → EIA respondent ID
export const ISO_MAP_REV = Object.fromEntries(
  Object.entries(ISO_MAP).map(([k, v]) => [v, k])
);

// ── Internal fetch helpers ───────────────────────────────────────
// Auth: query param ?api_key=KEY  (header auth not supported)
// Endpoint pattern: /datasets/{name}/query?limit=1&sort_order=desc

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gsGet(path, retries = 2) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${GS_BASE}${path}${sep}api_key=${GS_KEY}`;
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    // Rate limited — back off and retry once
    await sleep(3000);
    return gsGet(path, retries - 1);
  }
  if (!res.ok) throw new Error(`GS ${res.status}: ${path}`);
  const json = await res.json();
  return json.data ?? json;
}

// Sequential fetcher — fires one request at a time with a gap to avoid 429s.
// Returns same shape as Promise.allSettled.
async function gsGetSequential(paths, delayMs = 300) {
  const results = [];
  for (const path of paths) {
    try {
      const value = await gsGet(path);
      results.push({ status: 'fulfilled', value });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
    await sleep(delayMs);
  }
  return results;
}

// ── Fuel name normalisation ──────────────────────────────────────
// Maps all per-ISO field names to: solar|wind|nuclear|gas|coal|hydro|battery|other
const FUEL_NORM = {
  // Gas / fossil
  'natural_gas':         'gas',
  'gas':                 'gas',
  'ng':                  'gas',
  'dual_fuel':           'gas',     // NYISO dual-fuel (mostly gas)
  'other_fossil_fuels':  'other',
  'diesel_fuel_oil':     'other',
  'oil':                 'other',
  'waste_heat':          'other',
  'multiple_fuels':      'other',
  // Coal
  'coal':                'coal',
  'coal_and_lignite':    'coal',    // ERCOT
  // Hydro
  'hydro':               'hydro',
  'hydropower':          'hydro',
  'large_hydro':         'hydro',   // CAISO
  'small_hydro':         'hydro',   // CAISO
  // Renewables
  'wind':                'wind',
  'solar':               'solar',
  'geothermal':          'other',
  'biomass':             'other',
  'biogas':              'other',
  'landfill_gas':        'other',
  'refuse':              'other',
  'wood':                'other',
  'other_renewables':    'other',
  // Battery / storage
  'battery':             'battery',
  'batteries':           'battery',
  'battery_storage':     'battery', // MISO
  'power_storage':       'battery', // ERCOT
  'storage':             'battery',
  // Nuclear
  'nuclear':             'nuclear',
  // Catch-all
  'imports':             'other',
  'other':               'other',
  'unknown':             'other',
};

function normFuel(raw) {
  return FUEL_NORM[String(raw).toLowerCase().replace(/\s+/g, '_')] ?? 'other';
}

// ── Public API ───────────────────────────────────────────────────

const SKIP_KEYS = new Set([
  'interval_start_utc', 'interval_end_utc',
  'interval_start_local', 'interval_end_local',
  'period', 'iso', 'market', 'type',
]);

function parseFuelMix(rows) {
  const first = Array.isArray(rows) ? rows[0] : rows;
  if (!first) return [];
  const fuelRows = Object.entries(first)
    .filter(([k]) => !SKIP_KEYS.has(k))
    .map(([k, v]) => ({ fuel: k, mw: +(v ?? 0) }))
    .filter(r => r.mw > 0);
  const agg = {};
  for (const { fuel, mw } of fuelRows) {
    const norm = normFuel(fuel);
    agg[norm] = (agg[norm] ?? 0) + mw;
  }
  return Object.entries(agg)
    .map(([fuel, mw]) => ({ fuel, mw: Math.round(mw) }))
    .sort((a, b) => b.mw - a.mw);
}

// ── Cache + concurrency guard ─────────────────────────────────────
// GridStatus free tier: 250 requests/month → 14 requests per full fetch.
// Strategy: cache results in localStorage for CACHE_TTL_MS. On page load,
// serve cached data instantly (0 API requests). Only re-fetch when stale.
// Do NOT re-fetch on the 5-minute EIA timer — ISO load data is stable enough.

const CACHE_KEY    = 'gs_iso_cache';
const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours (~3 days) — keeps usage ~10 fetches/month well under 250 limit

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL_MS) return data;
  } catch { /* ignore parse errors */ }
  return null;
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* ignore quota errors */ }
}

/**
 * Returns hours until the GridStatus cache expires, or null if no valid cache exists.
 * Use this to show "Live data resync in X hrs" instead of a generic "not connected" message.
 */
export function getCacheResyncHours() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts } = JSON.parse(raw);
    const msLeft = CACHE_TTL_MS - (Date.now() - ts);
    if (msLeft <= 0) return null;
    return Math.ceil(msLeft / (60 * 60 * 1000)); // round up to next whole hour
  } catch { return null; }
}

let _pendingFetch = null;

/**
 * Fetch load + fuel mix for all 7 ISOs in a single sequential loop.
 * One request at a time (load then fuel_mix per ISO) with a 1.1 s gap
 * to stay well under the GridStatus free-tier rate limit.
 * Returns cached data immediately if < 1 hour old (saves API quota).
 * Returns {} immediately if no API key is configured.
 * Concurrent callers all share the same in-flight promise.
 *
 * @returns {Promise<{ [isoSlug]: { load_mw?: number, period?: string, fuelMix: Array } }>}
 */
export async function fetchAllIsoData() {
  if (!GS_KEY) return {};
  const cached = readCache();
  if (cached) return cached;
  if (_pendingFetch) return _pendingFetch;
  _pendingFetch = _fetchAllIsoDataImpl().finally(() => { _pendingFetch = null; });
  return _pendingFetch;
}

async function _fetchAllIsoDataImpl() {

  const isos   = Object.values(ISO_MAP);
  const out    = {};
  const DELAY  = 1100; // ms between each request — well under 1 req/s limit

  for (const iso of isos) {
    // ── Load ──────────────────────────────────────────────────────
    try {
      const data = await gsGet(
        `/datasets/${iso}_load/query?limit=1&sort_by=interval_start_utc&sort_order=desc`
      );
      const d  = Array.isArray(data) ? data[0] : data;
      const mw = +(d?.load ?? d?.load_mw ?? d?.value ?? 0);
      if (mw > 0) out[iso] = { load_mw: mw, period: d?.interval_start_utc ?? '' };
    } catch { /* single ISO failure is non-fatal */ }
    await sleep(DELAY);

    // ── Fuel mix ──────────────────────────────────────────────────
    try {
      const data    = await gsGet(
        `/datasets/${iso}_fuel_mix/query?limit=1&sort_by=interval_start_utc&sort_order=desc`
      );
      const fuelMix = parseFuelMix(Array.isArray(data) ? data : [data]);
      if (fuelMix.length) {
        out[iso] = { ...(out[iso] ?? {}), fuelMix };
      }
    } catch { /* single ISO failure is non-fatal */ }
    await sleep(DELAY);
  }

  if (Object.keys(out).length > 0) writeCache(out);
  return out;
}

// ── Legacy exports kept for backward compat ──────────────────────
export async function fetchIsoLoad()    { return {}; }
export async function fetchIsoFuelMix() { return {}; }
export function mergeIsoData(loads, fuels) {
  const isos = new Set([...Object.keys(loads), ...Object.keys(fuels)]);
  const out  = {};
  for (const iso of isos) out[iso] = { ...(loads[iso] ?? {}), fuelMix: fuels[iso] ?? [] };
  return out;
}
