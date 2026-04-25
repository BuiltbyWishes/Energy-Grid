import { useState, useCallback, useMemo } from 'react'
import {
  ComposableMap, Geographies, Geography, Marker, Line,
} from 'react-simple-maps'
import { PLANT_COLORS } from '../data/plants'
import { DATA_CENTERS, flowColor } from '../data/dataCenters'
import { REGIONS } from '../api/eia'

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
  if (demand === 0) return '#3B82F6'
  return ratio >= 0.95 ? '#34C759' : ratio >= 0.80 ? '#FFCC00' : '#FF3B30'
}

function PlantTooltip({ data }) {
  const color    = PLANT_COLORS[data.type]
  const ecoColor = data.eco_score >= 80 ? '#34C759' : data.eco_score >= 50 ? '#FFCC00' : '#FF3B30'
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
        <span style={{ color: '#F59E0B' }}>+{data.yoy_growth_percent}%</span>
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
  plants, regionData = {}, selected,
  onRegionClick, onPlantClick, onDcClick,
}) {
  const [filter, setFilter]       = useState('all')
  const [tooltip, setTooltip]     = useState(null)
  const [flowTip, setFlowTip]     = useState(null)

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
            <stop offset="0%"   stopColor="#020817" stopOpacity="0" />
            <stop offset="100%" stopColor="#020817" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* States */}
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="rgba(5, 15, 40, 0.9)"
                stroke="#1E40AF"
                strokeWidth={0.7}
                style={{
                  default: { outline: 'none', filter: 'url(#state-glow)' },
                  hover:   { fill: 'rgba(59,130,246,0.09)', outline: 'none', filter: 'url(#state-glow)' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {/* Vignette */}
        <rect x="0" y="0" width="960" height="600" fill="url(#map-vignette)" pointerEvents="none" />

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

        {/* ── Data centers ──────────────────────────────────── */}
        {DATA_CENTERS.map(dc => {
          const r      = 3 + (dc.energy_consumption_mw / 350) * 5.5
          const color  = flowColor(dc.energy_consumption_mw)
          const dimmed = hasNetworkSel && !highlightedDcIds.has(dc.id)
          const isHl   = hasNetworkSel && highlightedDcIds.has(dc.id)
          return (
            <Marker
              key={dc.id}
              coordinates={[dc.lng, dc.lat]}
              onMouseEnter={e => showTip(e, 'dc', dc)}
              onMouseLeave={hideTip}
              onClick={() => onDcClick?.(dc)}
            >
              <g opacity={dimmed ? 0.12 : 1} style={{ transition: 'opacity 0.25s' }}>
                <circle r={r + 6} fill={`${color}${isHl ? '20' : '12'}`} />
                <circle
                  r={isHl ? r + 2 : r}
                  fill={`${color}30`}
                  stroke={color}
                  strokeWidth={isHl ? 2 : 1.1}
                  filter="url(#dot-glow)"
                  style={{ cursor: 'pointer' }}
                />
                <circle r={1.8} fill={color} />
              </g>
            </Marker>
          )
        })}

        {/* ── Power plants ──────────────────────────────────── */}
        {visiblePlants.map(plant => {
          const color  = PLANT_COLORS[plant.type]
          const r      = 5 + (plant.capacity_mw / 6809) * 7
          const dimmed = hasNetworkSel && !highlightedPlantIds.has(plant.id)
          const isHl   = hasNetworkSel && highlightedPlantIds.has(plant.id)
          return (
            <Marker
              key={plant.id}
              coordinates={[plant.lng, plant.lat]}
              onMouseEnter={e => showTip(e, 'plant', plant)}
              onMouseLeave={hideTip}
              onClick={() => onPlantClick?.(plant)}
            >
              <g opacity={dimmed ? 0.12 : 1} style={{ transition: 'opacity 0.25s' }}>
                <circle
                  r={r + 7}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHl ? 1.5 : 0.8}
                  strokeOpacity={isHl ? 0.6 : 0.3}
                  className="plant-ring"
                />
                <circle
                  r={isHl ? r + 2 : r}
                  fill={`${color}40`}
                  stroke={color}
                  strokeWidth={isHl ? 2 : 1.3}
                  filter="url(#dot-glow)"
                  style={{ cursor: 'pointer' }}
                />
                <circle r={2.5} fill={color} />
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
      </ComposableMap>

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
    </div>
  )
}
