import CollapsibleSection from './CollapsibleSection'

// Vivid fuel palette — matches plant types
const FUEL_COLORS = {
  NG:  '#F89040',  // vivid amber-orange
  COL: '#8B9CB8',  // blue-slate (intentionally muted)
  NUC: '#CC88FF',  // vivid violet
  WAT: '#58A0F8',  // vivid steel blue
  WND: '#40D8F0',  // vivid blue-teal
  SUN: '#F8C030',  // vivid warm gold
  OIL: '#F55858',  // vivid red
  GEO: '#E87070',  // vivid brick
  OTH: '#6B7A94',  // muted slate
}

const FUEL_ORDER = ['NG','NUC','WAT','WND','SUN','COL','GEO','OIL','OTH']

export default function FuelMixPanel({ fuelMix }) {
  if (!fuelMix?.length) return null

  const sorted = [...fuelMix].sort((a, b) => {
    const ai = FUEL_ORDER.indexOf(a.fueltype)
    const bi = FUEL_ORDER.indexOf(b.fueltype)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  const total = sorted.reduce((s, f) => s + f.value, 0)

  return (
    <CollapsibleSection title="National Fuel Mix" defaultOpen={true}>
      {/* Stacked bar */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
          {sorted.map(f => (
            <div
              key={f.fueltype}
              style={{
                width: `${(f.value / total) * 100}%`,
                background: FUEL_COLORS[f.fueltype] ?? '#6B7A94',
                transition: 'width 0.4s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Legend rows */}
      <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sorted.map(f => {
          const pct   = ((f.value / total) * 100).toFixed(1)
          const color = FUEL_COLORS[f.fueltype] ?? '#6B7A94'
          const gw    = (f.value / 1000).toFixed(1)
          return (
            <div key={f.fueltype} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>
                {f.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>{gw} GW</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, fontWeight: 500, width: 36, textAlign: 'right' }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
