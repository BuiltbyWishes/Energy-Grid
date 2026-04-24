import { DATA_CENTERS } from '../data/dataCenters'

const sorted = [...DATA_CENTERS].sort((a, b) => b.energy_consumption_mw - a.energy_consumption_mw)
const maxMw = sorted[0].energy_consumption_mw

function loadColor(mw) {
  if (mw > 250) return 'var(--red)'
  if (mw > 150) return 'var(--orange)'
  if (mw > 80)  return 'var(--yellow)'
  return 'var(--green)'
}

export default function DcRankings() {
  return (
    <section>
      <div className="section-title">DC Power Draw</div>
      <div>
        {sorted.map((dc, i) => {
          const color = loadColor(dc.energy_consumption_mw)
          const pct = (dc.energy_consumption_mw / maxMw) * 100
          return (
            <div
              key={dc.id}
              style={{ padding: '7px 16px', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--text-dim)', width: 14, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dc.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                    {dc.city}, {dc.state}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, fontWeight: 500 }}>
                    {dc.energy_consumption_mw} MW
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)' }}>
                    +{dc.yoy_growth_percent}% YoY
                  </div>
                </div>
              </div>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1, marginLeft: 22 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1, transition: 'width 0.4s' }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
