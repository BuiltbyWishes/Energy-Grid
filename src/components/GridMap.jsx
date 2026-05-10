import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup,
} from 'react-simple-maps'
import { PLANT_COLORS } from '../data/plants'
import { DATA_CENTERS, flowColor } from '../data/dataCenters'
import { REGIONS } from '../api/eia'
import { getCacheResyncHours } from '../api/gridstatus'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const FILTERS = [
  { key: 'all',         label: 'ALL' },
  { key: 'nuclear',     label: 'NUCLEAR' },
  { key: 'hydro',       label: 'HYDRO' },
  { key: 'solar',       label: 'SOLAR' },
  { key: 'wind',        label: 'WIND' },
  { key: 'geothermal',  label: 'GEO' },
  { key: 'natural_gas', label: 'GAS' },
  { key: 'coal',        label: 'COAL' },
]

// ISO zone overlay — blue tint family, resaturated (matches IsoFuelPanel)
const ISO_COLORS = {
  caiso: '#58A0F8',  // vivid steel blue
  ercot: '#66B8F0',  // lighter vivid blue
  pjm:   '#72CCE0',  // blue-teal
  miso:  '#58B8CC',  // teal variant
  spp:   '#4888D8',  // deeper blue
  nyiso: '#8090F0',  // blue-violet
  isone: '#9878E0',  // soft violet
}

const ISO_LABELS = {
  caiso: 'CAISO', ercot: 'ERCOT', pjm: 'PJM',
  miso:  'MISO',  spp:   'SPP',  nyiso: 'NYISO', isone: 'ISO-NE',
}

const ISO_FUEL_COLORS = {
  solar:   '#F8C030', wind:    '#40D8F0', nuclear: '#CC88FF',
  hydro:   '#58A0F8', gas:     '#F89040', coal:    '#8B9CB8',
  battery: '#28E898', other:   '#6B7A94',
}

function IsoPopup({ iso, isoData, onClose }) {
  const label       = ISO_LABELS[iso] ?? iso.toUpperCase()
  const color       = ISO_COLORS[iso] ?? 'var(--teal)'
  const data        = isoData[iso]
  const fuelMix     = data?.fuelMix ?? []
  const total       = fuelMix.reduce((s, f) => s + f.mw, 0)
  const loadMw      = data?.load_mw
  const resyncHours = getCacheResyncHours()

  return (
    <div style={{
      background: 'rgba(12,12,14,0.97)',
      border: `1px solid ${color}55`,
      borderRadius: 6,
      padding: '10px 12px',
      fontFamily: 'var(--font-mono)',
      minWidth: 158,
      boxShadow: `0 4px 24px rgba(0,0,0,0.65), 0 0 18px ${color}22`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: 1, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px' }}
        >✕</button>
      </div>

      {/* Load */}
      {loadMw != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>LOAD</span>
          <span style={{ fontSize: 9, color }}>{(loadMw / 1000).toFixed(1)} GW</span>
        </div>
      )}

      {/* Fuel bar + rows */}
      {fuelMix.length > 0 ? (
        <>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
            {fuelMix.map(f => (
              <div key={f.fuel} style={{
                width: `${(f.mw / total) * 100}%`,
                background: ISO_FUEL_COLORS[f.fuel] ?? '#6B7A94',
              }} />
            ))}
          </div>
          {fuelMix.slice(0, 4).map(f => (
            <div key={f.fuel} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
              <span style={{ color: ISO_FUEL_COLORS[f.fuel] ?? 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {f.fuel}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                {total > 0 ? `${Math.round((f.mw / total) * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.65, marginBottom: 4 }}>
          {!import.meta.env.VITE_GRIDSTATUS_API_KEY
            ? (resyncHours != null ? `Live data resync in ${resyncHours} hrs` : 'Live fuel data not connected')
            : 'Fetching fuel data…'
          }
        </div>
      )}

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 8, borderTop: '1px solid rgba(75,139,222,0.1)', paddingTop: 5 }}>
        Click zone again · ESC to close
      </div>
    </div>
  )
}

// State FIPS → ISO slug (numeric FIPS as used in us-atlas states-10m.json)
// States that span multiple ISOs are assigned to the dominant operator.
// Western states not in any of the 7 ISOs are omitted (render with default dark fill).
const ISO_STATE_FIPS = new Map([
  // CAISO
  [6,  'caiso'],  // California
  // ERCOT
  [48, 'ercot'],  // Texas (ERCOT covers ~90% of TX)
  // PJM
  [10, 'pjm'],   // Delaware
  [11, 'pjm'],   // DC
  [24, 'pjm'],   // Maryland
  [34, 'pjm'],   // New Jersey
  [39, 'pjm'],   // Ohio
  [42, 'pjm'],   // Pennsylvania
  [51, 'pjm'],   // Virginia
  [54, 'pjm'],   // West Virginia
  [26, 'pjm'],   // Michigan (Lower Peninsula — PJM)
  // MISO
  [5,  'miso'],  // Arkansas
  [17, 'miso'],  // Illinois (predominantly MISO)
  [18, 'miso'],  // Indiana (predominantly MISO)
  [19, 'miso'],  // Iowa
  [21, 'miso'],  // Kentucky
  [22, 'miso'],  // Louisiana
  [27, 'miso'],  // Minnesota
  [28, 'miso'],  // Mississippi
  [29, 'miso'],  // Missouri
  [38, 'miso'],  // North Dakota
  [46, 'miso'],  // South Dakota (eastern portion in MISO)
  [55, 'miso'],  // Wisconsin
  // SPP
  [20, 'spp'],   // Kansas
  [31, 'spp'],   // Nebraska
  [40, 'spp'],   // Oklahoma
  // NYISO
  [36, 'nyiso'], // New York
  // ISO-NE
  [9,  'isone'], // Connecticut
  [23, 'isone'], // Maine
  [25, 'isone'], // Massachusetts
  [33, 'isone'], // New Hampshire
  [44, 'isone'], // Rhode Island
  [50, 'isone'], // Vermont
])

const DC_MAP = Object.fromEntries(DATA_CENTERS.map(dc => [dc.id, dc]))

function buildFlowLines(plants) {
  const lines = []
  for (const plant of plants) {
    for (const dcId of plant.connected_dc_ids) {
      const dc = DC_MAP[dcId]
      if (!dc) continue
      lines.push({
        id:        `${plant.id}-${dcId}`,
        from:      [plant.lng, plant.lat],
        to:        [dc.lng,    dc.lat],
        color:     flowColor(dc.energy_consumption_mw),
        plantId:   plant.id,
        dcId:      dcId,
        plantName: plant.name,
        dcName:    dc.name,
        dcMw:      dc.energy_consumption_mw,
      })
    }
  }
  return lines
}

function regionStatusColor(demand, netGen) {
  const ratio = demand > 0 ? netGen / demand : 0
  if (demand === 0) return '#58A0F8'   // vivid steel blue when no data
  return ratio >= 0.95 ? '#28E898' : ratio >= 0.80 ? '#F5D830' : '#F55858'
}

function PlantTooltip({ data }) {
  const color    = PLANT_COLORS[data.type]
  const ecoColor = data.eco_score >= 80 ? '#28E898' : data.eco_score >= 50 ? '#F5D830' : '#F55858'
  return (
    <>
      <div className="tt-name">{data.name}</div>
      <div className="tt-row">
        <span>Type</span>
        <span style={{ color }}>{data.type.replace('_', ' ')}</span>
      </div>
      <div className="tt-row">
        <span>Capacity</span>
        <span>{data.capacity_mw.toLocaleString()} MW</span>
      </div>
      {data.current_output_mw != null && (
        <div className="tt-row">
          <span>Output</span>
          <span>{data.current_output_mw.toLocaleString()} MW</span>
        </div>
      )}
      <div className="tt-row">
        <span>Eco</span>
        <span style={{ color: ecoColor }}>{data.eco_score}/100 · {data.eco_grade}</span>
      </div>
    </>
  )
}

function DcTooltip({ data }) {
  const color = flowColor(data.energy_consumption_mw)
  return (
    <>
      <div className="tt-name">{data.name}</div>
      <div className="tt-row">
        <span>Operator</span>
        <span>{data.operator}</span>
      </div>
      <div className="tt-row">
        <span>Draw</span>
        <span style={{ color }}>{data.energy_consumption_mw} MW</span>
      </div>
      <div className="tt-row">
        <span>Peak</span>
        <span>{data.peak_consumption_mw} MW</span>
      </div>
      <div className="tt-row">
        <span>PUE</span>
        <span>{data.pue_ratio}</span>
      </div>
      <div className="tt-row">
        <span>YoY growth</span>
        <span style={{ color: '#F8C030' }}>+{data.yoy_growth_percent}%</span>
      </div>
    </>
  )
}

function FlowTooltip({ data }) {
  return (
    <>
      <div className="tt-name" style={{ fontSize: 10 }}>{data.plantName}</div>
      <div className="tt-row">
        <span>→</span>
        <span>{data.dcName}</span>
      </div>
      <div className="tt-row">
        <span>DC draw</span>
        <span style={{ color: data.color }}>{data.dcMw} MW</span>
      </div>
    </>
  )
}

export default function GridMap({
  plants, regionData = {}, isoData = {}, selected,
  onRegionClick, onPlantClick, onDcClick,
}) {
  const [filter, setFilter]         = useState('all')
  const [showIsoZones, setShowIsoZones] = useState(true)
  const [tooltip, setTooltip]       = useState(null)
  const [flowTip, setFlowTip]       = useState(null)
  const [isoPopup, setIsoPopup]     = useState(null) // { iso, x, y }
  const [position, setPosition]     = useState({ coordinates: [0, 0], zoom: 1 })

  // Close ISO popup on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setIsoPopup(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const visiblePlants = filter === 'all' ? plants : plants.filter(p => p.type === filter)
  const visibleIds    = useMemo(() => new Set(visiblePlants.map(p => p.id)), [visiblePlants])
  const allFlowLines  = useMemo(() => buildFlowLines(plants), [plants])
  const visibleFlows  = useMemo(
    () => allFlowLines.filter(l => visibleIds.has(l.plantId)),
    [allFlowLines, visibleIds],
  )

  // ── Network highlight sets ──────────────────────────────────────
  const { highlightedPlantIds, highlightedDcIds, highlightedFlowIds } = useMemo(() => {
    if (selected?.type === 'plant') {
      const hPlants = new Set([selected.data.id])
      const hDcs    = new Set(selected.data.connected_dc_ids ?? [])
      const hFlows  = new Set(visibleFlows.filter(l => l.plantId === selected.data.id).map(l => l.id))
      return { highlightedPlantIds: hPlants, highlightedDcIds: hDcs, highlightedFlowIds: hFlows }
    }
    if (selected?.type === 'dc') {
      const hDcs    = new Set([selected.data.id])
      const hPlants = new Set(
        plants.filter(p => p.connected_dc_ids?.includes(selected.data.id)).map(p => p.id),
      )
      const hFlows  = new Set(visibleFlows.filter(l => l.dcId === selected.data.id).map(l => l.id))
      return { highlightedPlantIds: hPlants, highlightedDcIds: hDcs, highlightedFlowIds: hFlows }
    }
    return { highlightedPlantIds: null, highlightedDcIds: null, highlightedFlowIds: null }
  }, [selected, plants, visibleFlows])

  const hasNetworkSel = selected?.type === 'plant' || selected?.type === 'dc'

  const showTip = useCallback((e, type, data) => {
    setFlowTip(null)
    setTooltip({ x: e.clientX, y: e.clientY, type, data })
  }, [])
  const hideTip = useCallback(() => setTooltip(null), [])

  const showFlowTip = useCallback((e, line) => {
    setTooltip(null)
    setFlowTip({ x: e.clientX, y: e.clientY, data: line })
  }, [])
  const hideFlowTip = useCallback(() => setFlowTip(null), [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1100 }}
        width={960}
        height={600}
        style={{ width: '100%', height: '100%', background: 'var(--bg-base)' }}
      >
        <defs>
          <filter id="state-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="region-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%"   stopColor="#0C0C0E" stopOpacity="0" />
            <stop offset="100%" stopColor="#0C0C0E" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={setPosition}
          minZoom={1}
          maxZoom={10}
        >

        {/* States */}
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="rgba(20, 20, 22, 0.95)"
                stroke="#303036"
                strokeWidth={0.7}
                style={{
                  default: { outline: 'none', filter: 'url(#state-glow)' },
                  hover:   { fill: 'rgba(75,139,222,0.07)', outline: 'none', filter: 'url(#state-glow)' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {/* ── ISO zone overlay ──────────────────────────────── */}
        {showIsoZones && (
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const fips = parseInt(geo.id, 10)
                const iso  = ISO_STATE_FIPS.get(fips)
                if (!iso) return null
                const color      = ISO_COLORS[iso]
                const hasData    = !!isoData[iso]
                const isSelected = isoPopup?.iso === iso
                return (
                  <Geography
                    key={`iso-${geo.rsmKey}`}
                    geography={geo}
                    fill={isSelected ? `${color}32` : `${color}15`}
                    stroke={color}
                    strokeWidth={isSelected ? 1.8 : 1.0}
                    strokeOpacity={isSelected ? 0.8 : hasData ? 0.55 : 0.22}
                    onClick={e => {
                      setIsoPopup(prev => prev?.iso === iso ? null : { iso, x: e.clientX, y: e.clientY })
                    }}
                    style={{
                      default: { outline: 'none', cursor: 'pointer' },
                      hover:   { fill: `${color}28`, outline: 'none', cursor: 'pointer' },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        )}

        {/* ── Visible flow lines ─────────────────────────────── */}
        {visibleFlows.map(line => {
          const dimmed = hasNetworkSel && !highlightedFlowIds.has(line.id)
          return (
            <Line
              key={line.id}
              from={line.from}
              to={line.to}
              stroke={line.color}
              strokeWidth={dimmed ? 0.5 : 1.2}
              strokeOpacity={dimmed ? 0.08 : 0.45}
              className="flow-line"
            />
          )
        })}

        {/* ── Invisible hit areas for flow hover ────────────── */}
        {visibleFlows.map(line => (
          <Line
            key={`${line.id}-hit`}
            from={line.from}
            to={line.to}
            stroke="transparent"
            strokeWidth={10}
            onMouseEnter={e => showFlowTip(e, line)}
            onMouseLeave={hideFlowTip}
            style={{ cursor: 'crosshair' }}
          />
        ))}

        {/* ── Power plants (rendered first = behind DCs in SVG stack) ── */}
        {visiblePlants.map(plant => {
          const color  = PLANT_COLORS[plant.type]
          const r      = 5 + (plant.capacity_mw / 6809) * 7
          const dimmed = hasNetworkSel && !highlightedPlantIds.has(plant.id)
          const isHl   = hasNetworkSel && highlightedPlantIds.has(plant.id)
          return (
            <Marker
              key={plant.id}
              coordinates={[plant.lng, plant.lat]}
              onClick={() => { hideTip(); onPlantClick?.(plant) }}
            >
              <g opacity={dimmed ? 0.12 : 1} style={{ transition: 'opacity 0.25s' }}>
                {/* Outer ring */}
                <circle
                  r={r + 7}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHl ? 1.5 : 0.8}
                  strokeOpacity={isHl ? 0.6 : 0.3}
                  className="plant-ring"
                />
                {/* Visual dot — hover fires only when cursor is over this */}
                <circle
                  r={isHl ? r + 2 : r}
                  fill={`${color}40`}
                  stroke={color}
                  strokeWidth={isHl ? 2 : 1.3}
                  filter="url(#dot-glow)"
                  onMouseEnter={e => showTip(e, 'plant', plant)}
                  onMouseLeave={hideTip}
                  style={{ cursor: 'pointer' }}
                />
                <circle
                  r={2.5}
                  fill={color}
                  onMouseEnter={e => showTip(e, 'plant', plant)}
                  onMouseLeave={hideTip}
                />
              </g>
            </Marker>
          )
        })}

        {/* ── Data centers (rendered after plants = on top in SVG stack) ── */}
        {DATA_CENTERS.map(dc => {
          const r      = 3 + (dc.energy_consumption_mw / 350) * 5.5
          const color  = flowColor(dc.energy_consumption_mw)
          const dimmed = hasNetworkSel && !highlightedDcIds.has(dc.id)
          const isHl   = hasNetworkSel && highlightedDcIds.has(dc.id)
          return (
            <Marker
              key={dc.id}
              coordinates={[dc.lng, dc.lat]}
              onClick={() => { hideTip(); onDcClick?.(dc) }}
            >
              <g opacity={dimmed ? 0.12 : 1} style={{ transition: 'opacity 0.25s' }}>
                {/* Glow halo */}
                <circle r={r + 6} fill={`${color}${isHl ? '20' : '12'}`} />
                {/* Visual dot */}
                <circle
                  r={isHl ? r + 2 : r}
                  fill={`${color}30`}
                  stroke={color}
                  strokeWidth={isHl ? 2 : 1.1}
                  filter="url(#dot-glow)"
                  onMouseEnter={e => showTip(e, 'dc', dc)}
                  onMouseLeave={hideTip}
                  style={{ cursor: 'pointer' }}
                />
                <circle
                  r={1.8}
                  fill={color}
                  onMouseEnter={e => showTip(e, 'dc', dc)}
                  onMouseLeave={hideTip}
                />
              </g>
            </Marker>
          )
        })}

        {/* ── Region markers ────────────────────────────────── */}
        {REGIONS.map(r => {
          const data    = regionData[r.id] ?? {}
          const demand  = data.demand ?? 0
          const netGen  = data.netGen  ?? 0
          const color   = regionStatusColor(demand, netGen)
          const isSelReg = selected?.type === 'region' && selected.data.id === r.id
          const sz      = isSelReg ? 13 : 10
          return (
            <Marker
              key={r.id}
              coordinates={[r.lng, r.lat]}
              onClick={() => onRegionClick?.(r)}
              style={{ cursor: 'pointer' }}
            >
              {/* transparent touch target — kept small so nearby plant/DC markers stay clickable */}
              <circle r={sz + 5} fill="transparent" style={{ cursor: 'pointer' }} />
              {/* Outer halo */}
              <circle
                r={sz + 10}
                fill={`${color}08`}
                stroke={color}
                strokeWidth={0.5}
                strokeOpacity={0.3}
                strokeDasharray="3 4"
              />
              {/* Diamond */}
              <polygon
                points={`0,${-sz} ${sz},0 0,${sz} ${-sz},0`}
                fill={isSelReg ? `${color}35` : `${color}15`}
                stroke={color}
                strokeWidth={isSelReg ? 2 : 1.5}
                filter="url(#region-glow)"
                style={{ cursor: 'pointer' }}
              />
              {/* Region label */}
              <text
                y={sz + 12}
                textAnchor="middle"
                fill={color}
                fontSize={8}
                fontFamily="DM Mono, monospace"
                fontWeight="500"
                style={{ pointerEvents: 'none' }}
              >
                {r.name}
              </text>
              {demand > 0 && (
                <text
                  y={sz + 21}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.35)"
                  fontSize={7}
                  fontFamily="DM Mono, monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {(demand / 1000).toFixed(0)} GW
                </text>
              )}
            </Marker>
          )
        })}

        </ZoomableGroup>

        {/* Vignette — outside ZoomableGroup so it stays fixed on screen */}
        <rect x="0" y="0" width="960" height="600" fill="url(#map-vignette)" pointerEvents="none" />

      </ComposableMap>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 52, left: 12,
        display: 'flex', flexDirection: 'column', gap: 3, zIndex: 10,
      }}>
        {[
          { label: '+', action: () => setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.5, 10) })) },
          { label: '−', action: () => setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) })) },
        ].map(({ label, action }) => (
          <button key={label} onClick={action} style={{
            width: 28, height: 28,
            background: 'rgba(12,12,14,0.85)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 16, lineHeight: 1,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--teal)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >{label}</button>
        ))}
        {position.zoom > 1 && (
          <button
            onClick={() => setPosition({ coordinates: [0, 0], zoom: 1 })}
            title="Reset view"
            style={{
              width: 28, height: 28,
              background: 'rgba(12,12,14,0.85)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11, lineHeight: 1,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--teal)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >↺</button>
        )}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}

        {/* Divider */}
        <span style={{
          alignSelf: 'center',
          width: 1, height: 16,
          background: 'var(--border)',
          flexShrink: 0,
          margin: '0 2px',
        }} />

        {/* ISO Zones toggle */}
        <button
          className={`filter-btn${showIsoZones ? ' active' : ''}`}
          onClick={() => setShowIsoZones(v => !v)}
          title="Toggle ISO/RTO zone overlay"
        >
          ISO ZONES
        </button>
      </div>

      {/* Marker tooltip */}
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          {tooltip.type === 'plant'
            ? <PlantTooltip data={tooltip.data} />
            : <DcTooltip   data={tooltip.data} />
          }
        </div>
      )}

      {/* Flow line tooltip */}
      {flowTip && (
        <div className="map-tooltip" style={{ left: flowTip.x + 14, top: flowTip.y - 10 }}>
          <FlowTooltip data={flowTip.data} />
        </div>
      )}

      {/* ISO zone popup */}
      {isoPopup && (
        <div style={{
          position: 'fixed',
          left: Math.min(isoPopup.x + 16, window.innerWidth - 210),
          top:  Math.max(isoPopup.y - 20, 10),
          zIndex: 500,
          pointerEvents: 'auto',
        }}>
          <IsoPopup iso={isoPopup.iso} isoData={isoData} onClose={() => setIsoPopup(null)} />
        </div>
      )}
    </div>
  )
}
