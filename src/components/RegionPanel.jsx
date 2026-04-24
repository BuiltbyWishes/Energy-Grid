import { REGIONS } from '../api/eia'

function fmtGW(mw) {
  if (!mw) return '—'
  return `${(mw / 1000).toFixed(1)} GW`
}

export default function RegionPanel({ regionData }) {
  const demands = REGIONS.map(r => regionData[r.id]?.demand ?? 0)
  const maxDemand = Math.max(...demands, 1)

  return (
    <section>
      <div className="section-title">Grid Regions</div>
      <div>
        {REGIONS.map(r => {
          const data = regionData[r.id] ?? {}
          const demand = data.demand ?? 0
          const netGen = data.netGen ?? 0
          const pct = (demand / maxDemand) * 100
          const ratio = demand > 0 ? netGen / demand : 0
          const statusColor = ratio >= 0.95 ? 'var(--green)' : ratio >= 0.80 ? 'var(--yellow)' : 'var(--red)'

          return (
            <div key={r.id} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: statusColor, flexShrink: 0,
                  boxShadow: `0 0 6px ${statusColor}`,
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', flex: 1 }}>
                  {r.name}
                </span>
                <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  <span style={{ color: 'var(--teal)' }}>{fmtGW(demand)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>/</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmtGW(netGen)}</span>
                </div>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--teal), var(--blue))',
                  borderRadius: 2, transition: 'width 0.4s',
                }} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 3,
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
              }}>
                <span>DEMAND / NET GEN</span>
                <span style={{ color: statusColor }}>{demand > 0 ? `${Math.round(ratio * 100)}%` : '—'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
