import { useState, useEffect, useCallback } from 'react'
import { fetchRegionDemand, fetchFuelMix, fetchPlantGeneration } from './api/eia'
import { PLANTS } from './data/plants'
import { DATA_CENTERS } from './data/dataCenters'
import GridMap from './components/GridMap'
import FuelMixPanel from './components/FuelMixPanel'
import DcRankings from './components/DcRankings'
import RegionPanel from './components/RegionPanel'
import EcoPanel from './components/EcoPanel'
import DetailPanel from './components/DetailPanel'
import './index.css'

const REFRESH_MS = 5 * 60 * 1000;

function fmtGW(mw) {
  if (mw == null || isNaN(mw)) return '—';
  return `${(mw / 1000).toFixed(1)} GW`;
}

function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

export default function App() {
  const [plants, setPlants]         = useState(PLANTS);
  const [fuelMix, setFuelMix]       = useState([]);
  const [regionData, setRegionData] = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState(null); // { type: 'region'|'plant'|'dc', data }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const clock                       = useClock();

  const load = useCallback(async () => {
    try {
      const [rd, fm, pg] = await Promise.all([
        fetchRegionDemand(),
        fetchFuelMix(),
        fetchPlantGeneration(PLANTS),
      ]);
      setRegionData(rd);
      setFuelMix(fm);
      setPlants(PLANTS.map(p => {
        const live = pg[String(p.eia_id)];
        return live
          ? { ...p, current_output_mw: live.current_output_mw, live_period: live.period }
          : p;
      }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Click handlers ────────────────────────────────────────────
  const handleRegionClick = useCallback(region => {
    setSelected(prev =>
      prev?.type === 'region' && prev.data.id === region.id ? null : { type: 'region', data: region }
    );
  }, []);

  const handlePlantClick = useCallback(plant => {
    setSelected(prev =>
      prev?.type === 'plant' && prev.data.id === plant.id ? null : { type: 'plant', data: plant }
    );
  }, []);

  const handleDcClick = useCallback(dc => {
    setSelected(prev =>
      prev?.type === 'dc' && prev.data.id === dc.id ? null : { type: 'dc', data: dc }
    );
  }, []);

  // ── Derived stats ──────────────────────────────────────────────
  const totalDemand = Object.values(regionData).reduce((s, r) => s + (r.demand ?? 0), 0);
  const totalNetGen = Object.values(regionData).reduce((s, r) => s + (r.netGen  ?? 0), 0);
  const totalDcDraw = DATA_CENTERS.reduce((s, dc) => s + dc.energy_consumption_mw, 0);
  const dcPctOfGrid = totalDemand > 0 ? ((totalDcDraw / totalDemand) * 100).toFixed(1) : '—';

  const renewables  = fuelMix.filter(f => ['SUN','WND','WAT'].includes(f.fueltype))
                        .reduce((s, f) => s + f.value, 0);
  const totalGen    = fuelMix.reduce((s, f) => s + f.value, 0);
  const renewPct    = totalGen > 0 ? Math.round((renewables / totalGen) * 100) : null;

  const avgEco      = Math.round(plants.reduce((s, p) => s + p.eco_score, 0) / plants.length);
  const cleanest    = [...plants].sort((a, b) => b.eco_score - a.eco_score)[0];
  const dirtiest    = [...plants].sort((a, b) => a.eco_score - b.eco_score)[0];

  if (loading) {
    return (
      <div className="fullscreen-state">
        <div className="loading-pulse" />
        Connecting to EIA grid…
      </div>
    );
  }

  if (error) {
    return <div className="fullscreen-state error">EIA API error: {error}</div>;
  }

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <span className="header-logo">⚡ Energy Grid</span>

        <div className="header-stats">
          <div className="header-stat">
            <span className="header-stat-label">US Demand</span>
            <span className="header-stat-value teal">{fmtGW(totalDemand)}</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">Net Generation</span>
            <span className="header-stat-value blue">{fmtGW(totalNetGen)}</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">Renewables</span>
            <span className="header-stat-value green">{renewPct != null ? `${renewPct}%` : '—'}</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">DC Draw</span>
            <span className="header-stat-value amber">{fmtGW(totalDcDraw)} ({dcPctOfGrid}%)</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">Avg Eco Score</span>
            <span className="header-stat-value">{avgEco}/100</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">Cleanest</span>
            <span className="header-stat-value green">{cleanest?.name ?? '—'}</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">Dirtiest</span>
            <span className="header-stat-value red">{dirtiest?.name ?? '—'}</span>
          </div>
        </div>

        <span className="header-clock">
          {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
        </span>
      </header>

      {/* ── Main ── */}
      <div className="main-layout">
        <div className="map-area">
          <GridMap
            plants={plants}
            regionData={regionData}
            selected={selected}
            onRegionClick={handleRegionClick}
            onPlantClick={handlePlantClick}
            onDcClick={handleDcClick}
          />
          <button
            className="mobile-data-btn"
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? '✕ CLOSE' : '⚡ DATA'}
          </button>
        </div>

        <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
          {selected?.type === 'region' ? (
            <DetailPanel
              region={selected.data}
              regionData={regionData}
              onClose={() => { setSelected(null); setSidebarOpen(false); }}
            />
          ) : (
            <>
              <FuelMixPanel fuelMix={fuelMix} />
              <RegionPanel regionData={regionData} />
              <DcRankings />
              <EcoPanel plants={plants} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
