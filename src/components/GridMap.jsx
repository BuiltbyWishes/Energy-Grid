import { useState, useCallback } from 'react'
import {
  ComposableMap, Geographies, Geography, Marker, Line,
} from 'react-simple-maps'
import { PLANT_COLORS } from '../data/plants'
import { DATA_CENTERS, flowColor } from '../data/dataCenters'

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
        id: `${plant.id}-${dcId}`,
        from: [plant.lng, plant.lat],
        to:   [dc.lng,    dc.lat],
        color: flowColor(dc.energy_consumption_mw),
        plantId: plant.id,
      })
    }
  }
  return lines
}

function PlantTooltip({ data }) {
  const color = PLANT_COLORS[data.type]
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

export default function GridMap({ plants, onPlantClick, onDcClick }) {
  const [filter, setFilter]   = useState('all')
  const [tooltip, setTooltip] = useState(null)

  const visiblePlants = filter === 'all' ? plants : plants.filter(p => p.type === filter)
  const visibleIds    = new Set(visiblePlants.map(p => p.id))
  const allFlowLines  = buildFlowLines(plants)
  const visibleFlows  = allFlowLines.filter(l => visibleIds.has(l.plantId))

  const showTip = useCallback((e, type, data) => {
    setTooltip({ x: e.clientX, y: e.clientY, type, data })
  }, [])
  const hideTip = useCallback(() => setTooltip(null), [])

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
          {/* State border glow */}
          <filter id="state-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Marker glow */}
          <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle inner fill glow for states */}
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

        {/* Vignette overlay */}
        <rect x="0" y="0" width="960" height="600" fill="url(#map-vignette)" pointerEvents="none" />

        {/* Flow lines — behind markers */}
        {visibleFlows.map(line => (
          <Line
            key={line.id}
            from={line.from}
            to={line.to}
            stroke={line.color}
            strokeWidth={0.9}
            strokeOpacity={0.4}
            className="flow-line"
          />
        ))}

        {/* Data centers */}
        {DATA_CENTERS.map(dc => {
          const r     = 3 + (dc.energy_consumption_mw / 350) * 5.5
          const color = flowColor(dc.energy_consumption_mw)
          return (
            <Marker
              key={dc.id}
              coordinates={[dc.lng, dc.lat]}
              onMouseEnter={e => showTip(e, 'dc', dc)}
              onMouseLeave={hideTip}
              onClick={() => onDcClick?.(dc)}
            >
              {/* Outer halo */}
              <circle r={r + 6} fill={`${color}12`} />
              {/* Main body */}
              <circle
                r={r}
                fill={`${color}30`}
                stroke={color}
                strokeWidth={1.1}
                filter="url(#dot-glow)"
                style={{ cursor: 'pointer' }}
              />
              {/* Core */}
              <circle r={1.8} fill={color} />
            </Marker>
          )
        })}

        {/* Power plants */}
        {visiblePlants.map(plant => {
          const color = PLANT_COLORS[plant.type]
          const r     = 5 + (plant.capacity_mw / 6809) * 7
          return (
            <Marker
              key={plant.id}
              coordinates={[plant.lng, plant.lat]}
              onMouseEnter={e => showTip(e, 'plant', plant)}
              onMouseLeave={hideTip}
              onClick={() => onPlantClick?.(plant)}
            >
              {/* Pulse ring */}
              <circle
                r={r + 7}
                fill="none"
                stroke={color}
                strokeWidth={0.8}
                strokeOpacity={0.3}
                className="plant-ring"
              />
              {/* Body */}
              <circle
                r={r}
                fill={`${color}40`}
                stroke={color}
                strokeWidth={1.3}
                filter="url(#dot-glow)"
                style={{ cursor: 'pointer' }}
              />
              {/* Core */}
              <circle r={2.5} fill={color} />
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

      {/* Tooltip */}
      {tooltip && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.type === 'plant'
            ? <PlantTooltip data={tooltip.data} />
            : <DcTooltip   data={tooltip.data} />
          }
        </div>
      )}
    </div>
  )
}
