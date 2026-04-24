const API_KEY = import.meta.env.VITE_EIA_API_KEY;
const BASE = 'https://api.eia.gov/v2';

function hoursAgo(n) {
  const d = new Date(Date.now() - n * 3600 * 1000);
  return d.toISOString().slice(0, 13);
}
function nowHour() {
  return new Date().toISOString().slice(0, 13);
}
function monthsAgoStr(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function get(path, params) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EIA ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.response?.error) throw new Error(json.response.error);
  return json.response?.data ?? [];
}

// RTO region metadata
export const REGIONS = [
  { id: 'PJM',  name: 'PJM',    lat: 40.5,  lng: -77.0  },
  { id: 'MISO', name: 'MISO',   lat: 41.5,  lng: -89.0  },
  { id: 'CISO', name: 'CAISO',  lat: 36.7,  lng: -119.5 },
  { id: 'ERCO', name: 'ERCOT',  lat: 31.5,  lng: -99.0  },
  { id: 'NYIS', name: 'NYISO',  lat: 43.0,  lng: -75.5  },
  { id: 'ISNE', name: 'ISO-NE', lat: 43.8,  lng: -71.5  },
  { id: 'SWPP', name: 'SPP',    lat: 37.5,  lng: -98.5  },
];

// Hourly demand + net generation per RTO
export async function fetchRegionDemand() {
  const params = [
    ['api_key', API_KEY],
    ['frequency', 'hourly'],
    ['data[0]', 'value'],
    ['facets[type][]', 'D'],
    ['facets[type][]', 'NG'],
    ['start', hoursAgo(3)],
    ['end', nowHour()],
    ['sort[0][column]', 'period'],
    ['sort[0][direction]', 'desc'],
    ['length', '100'],
  ];
  for (const r of REGIONS) params.push(['facets[respondent][]', r.id]);

  const data = await get('/electricity/rto/region-data/data/', params);

  const result = {};
  for (const row of data) {
    if (!result[row.respondent]) result[row.respondent] = { period: row.period };
    const entry = result[row.respondent];
    if (row.type === 'D'  && entry.demand  == null) entry.demand  = row.value;
    if (row.type === 'NG' && entry.netGen  == null) entry.netGen  = row.value;
  }
  return result;
}

// National fuel mix — latest hour
export async function fetchFuelMix() {
  const data = await get('/electricity/rto/fuel-type-data/data/', [
    ['api_key', API_KEY],
    ['frequency', 'hourly'],
    ['data[0]', 'value'],
    ['facets[respondent][]', 'US48'],
    ['start', hoursAgo(3)],
    ['end', nowHour()],
    ['sort[0][column]', 'period'],
    ['sort[0][direction]', 'desc'],
    ['length', '20'],
  ]);

  if (!data.length) return [];
  const latest = data[0].period;
  return data
    .filter(r => r.period === latest && (r.value ?? 0) > 0)
    .map(r => ({ fueltype: r.fueltype, name: r['type-name'] ?? r.fueltype, value: r.value }));
}

// Monthly plant-level generation — augments seed data with real output MW
export async function fetchPlantGeneration(plants) {
  const params = [
    ['api_key', API_KEY],
    ['frequency', 'monthly'],
    ['data[0]', 'generation'],
    ['start', monthsAgoStr(6)],
    ['end', monthsAgoStr(1)],
    ['sort[0][column]', 'period'],
    ['sort[0][direction]', 'desc'],
    ['length', '300'],
  ];
  for (const p of plants) params.push(['facets[plantid][]', String(p.eia_id)]);

  let data;
  try {
    data = await get('/electricity/facility-fuel/data/', params);
  } catch {
    return {}; // non-fatal — seed data still shows
  }

  // Sum MWh per plant per period, use most recent
  const byPlant = {};
  for (const row of data) {
    const pid  = String(row.plantid);
    const per  = row.period ?? '';
    const mwh  = row.generation ?? 0;
    if (!byPlant[pid]) byPlant[pid] = {};
    byPlant[pid][per] = (byPlant[pid][per] ?? 0) + mwh;
  }

  const output = {};
  for (const [pid, periods] of Object.entries(byPlant)) {
    const latestPeriod = Object.keys(periods).sort().at(-1);
    const totalMwh = periods[latestPeriod];
    output[pid] = {
      period: latestPeriod,
      current_output_mw: Math.round(totalMwh / 730), // MWh ÷ hrs-in-month → avg MW
    };
  }
  return output;
}

// Hourly demand + net gen timeseries for detail panel charts
export async function fetchRegionTimeseries(respondent) {
  const data = await get('/electricity/rto/region-data/data/', [
    ['api_key', API_KEY],
    ['frequency', 'hourly'],
    ['data[0]', 'value'],
    ['facets[respondent][]', respondent],
    ['facets[type][]', 'D'],
    ['facets[type][]', 'NG'],
    ['start', hoursAgo(24)],
    ['end', nowHour()],
    ['sort[0][column]', 'period'],
    ['sort[0][direction]', 'asc'],
    ['length', '100'],
  ]);

  const byPeriod = {};
  for (const row of data) {
    if (!byPeriod[row.period]) byPeriod[row.period] = { period: row.period };
    if (row.type === 'D')  byPeriod[row.period].demand  = row.value;
    if (row.type === 'NG') byPeriod[row.period].netGen  = row.value;
  }
  return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
}

// State-level annual net generation (for regional context)
export async function fetchStateGeneration() {
  try {
    return await get('/electricity/state-electricity-profiles/data/', [
      ['api_key', API_KEY],
      ['frequency', 'annual'],
      ['data[0]', 'net-generation'],
      ['sort[0][column]', 'period'],
      ['sort[0][direction]', 'desc'],
      ['length', '60'],
    ]);
  } catch {
    return [];
  }
}
