import { PLANT_COLORS, PLANT_ICONS } from '../data/plants'
import { DATA_CENTERS, flowColor } from '../data/dataCenters'
import { PLANTS } from '../data/plants'

const DC_MAP  = Object.fromEntries(DATA_CENTERS.map(dc => [dc.id, dc]))
const PLT_MAP = Object.fromEntries(PLANTS.map(p  => [p.id, p]))

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 8,
        color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: color ?? 'var(--text)', marginTop: 3,
      }}>
        {value}
      </div>
    </div>
  )
}

// Sticky header so ✕ CLOSE is always visible when content scrolls
function PanelHeader({ label, name, color, onClose }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px 10px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
          textTransform: 'uppercase', letterSpacing: 1.5,
        }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: color ?? 'var(--teal)', marginTop: 3 }}>
          {name}
        </div>
      </div>
      <button className="close-btn" onClick={onClose}>✕ CLOSE</button>
    </div>
  )
}

function ConnectedRow({ label, items, getColor, getName }) {
  if (!items?.length) return null
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(id => {
          const item = typeof id === 'string' ? (DC_MAP[id] ?? PLT_MAP[id]) : id
          if (!item) return null
          const name  = item.name ?? id
          const color = getColor ? getColor(item) : 'var(--text-muted)'
          return (
            <div key={id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 10,
            }}>
              <span style={{ color: 'var(--text)' }}>{name}</span>
              {getName && (
                <span style={{ color, fontSize: 9 }}>{getName(item)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Plant detail ─────────────────────────────────────────────
export function PlantDetailPanel({ plant, onClose }) {
  const color    = PLANT_COLORS[plant.type]
  const icon     = PLANT_ICONS[plant.type]
  const ecoColor = plant.eco_score >= 80 ? 'var(--green)'
                 : plant.eco_score >= 50 ? 'var(--yellow)'
                 : 'var(--red)'

  return (
    // Use 'selection-panel' — NOT 'detail-panel' — so the mobile CSS rule
    // that hides .detail-panel .close-btn does not affect this panel.
    <div className="selection-panel panel-in">
      <PanelHeader
        label="Power Plant"
        name={`${icon}  ${plant.name}`}
        color={color}
        onClose={onClose}
      />

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ borderRight: '1px solid var(--border)' }}>
          <StatBox label="Capacity" value={`${plant.capacity_mw.toLocaleString()} MW`} color={color} />
        </div>
        <div style={{ borderRight: '1px solid var(--border)' }}>
          <StatBox
            label="Output"
            value={plant.current_output_mw != null ? `${plant.current_output_mw.toLocaleString()} MW` : '—'}
            color="var(--teal)"
          />
        </div>
        <div>
          <StatBox label="Eco Score" value={`${plant.eco_score}/100`} color={ecoColor} />
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {[
          ['Type',   plant.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), color],
          ['State',  `${plant.state} · ${plant.region}`, 'var(--text-muted)'],
          ['Grade',  `${plant.eco_grade} — ${plant.eco_score >= 80 ? 'Clean' : plant.eco_score >= 50 ? 'Moderate' : 'High Emissions'}`, ecoColor],
          ['Carbon', `${plant.eco_factors.carbon_intensity_gco2_kwh} gCO₂/kWh`, ecoColor],
        ].map(([lbl, val, clr]) => (
          <div key={lbl} style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 7,
          }}>
            <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>{lbl}</span>
            <span style={{ color: clr }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Connected DCs */}
      <ConnectedRow
        label={`Connected Data Centers (${plant.connected_dc_ids?.length ?? 0})`}
        items={plant.connected_dc_ids}
        getColor={dc => flowColor(dc.energy_consumption_mw)}
        getName={dc => `${dc.energy_consumption_mw} MW`}
      />
    </div>
  )
}

// ── Data center detail ──────────────────────────────────────
const OPERATOR_COLORS = {
  AWS:       '#FF9500',
  Google:    '#34C759',
  Microsoft: '#3B82F6',
  Meta:      '#8B5CF6',
  Apple:     '#E2E8F0',
  Equinix:   '#0EEADC',
  Oracle:    '#EF4444',
  CyrusOne:  '#F59E0B',
  QTS:       '#F97316',
  Switch:    '#FFCC00',
}

export function DcDetailPanel({ dc, onClose }) {
  const color     = flowColor(dc.energy_consumption_mw)
  const opColor   = OPERATOR_COLORS[dc.operator] ?? 'var(--text)'
  const growthClr = dc.yoy_growth_percent >= 30 ? 'var(--red)'
                  : dc.yoy_growth_percent >= 20 ? 'var(--amber)'
                  : 'var(--green)'

  const connectedPlants = (dc.source_plant_ids ?? []).map(id => PLT_MAP[id]).filter(Boolean)

  return (
    <div className="selection-panel panel-in">
      <PanelHeader
        label="Data Center"
        name={dc.name}
        color={opColor}
        onClose={onClose}
      />

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ borderRight: '1px solid var(--border)' }}>
          <StatBox label="Draw" value={`${dc.energy_consumption_mw} MW`} color={color} />
        </div>
        <div style={{ borderRight: '1px solid var(--border)' }}>
          <StatBox label="Peak" value={`${dc.peak_consumption_mw} MW`} color="var(--amber)" />
        </div>
        <div>
          <StatBox label="YoY" value={`+${dc.yoy_growth_percent}%`} color={growthClr} />
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {[
          ['Operator',   dc.operator,                    opColor],
          ['Location',   `${dc.city}, ${dc.state}`,      'var(--text-muted)'],
          ['PUE Ratio',  `${dc.pue_ratio}×`,             dc.pue_ratio <= 1.15 ? 'var(--green)' : dc.pue_ratio <= 1.30 ? 'var(--yellow)' : 'var(--red)'],
          ['Throughput', `${dc.data_output_tbps} Tbps`,  'var(--teal)'],
        ].map(([lbl, val, clr]) => (
          <div key={lbl} style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 7,
          }}>
            <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>{lbl}</span>
            <span style={{ color: clr }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Source plants */}
      <ConnectedRow
        label={`Source Plants (${connectedPlants.length})`}
        items={connectedPlants.map(p => p.id)}
        getColor={p => PLANT_COLORS[p.type]}
        getName={p => p.type.replace('_', ' ')}
      />
    </div>
  )
}
