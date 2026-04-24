import { PLANT_COLORS } from '../data/plants'

function ecoColor(score) {
  if (score >= 80) return 'var(--green)'
  if (score >= 60) return 'var(--yellow)'
  if (score >= 40) return 'var(--orange)'
  return 'var(--red)'
}

function ArcGauge({ score }) {
  const r = 20, cx = 26, cy = 26
  const pathLen = Math.PI * r
  const filled = (score / 100) * pathLen
  const d = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`
  const color = ecoColor(score)
  return (
    <svg width={52} height={30} style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} strokeLinecap="round" />
      <path
        d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${filled} ${pathLen}`}
      />
      <text
        x={cx} y={cy - 2} textAnchor="middle"
        fill={color} fontSize={10} fontFamily="var(--font-mono)" fontWeight="500"
      >
        {score}
      </text>
    </svg>
  )
}

export default function EcoPanel({ plants }) {
  const sorted = [...plants].sort((a, b) => b.eco_score - a.eco_score)
  return (
    <section>
      <div className="section-title">Plant Eco Scores</div>
      <div>
        {sorted.map(p => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 16px', borderBottom: '1px solid var(--border)',
            }}
          >
            <ArcGauge score={p.eco_score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: PLANT_COLORS[p.type], flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                }}>
                  {p.type.replace('_', ' ')}
                </span>
                {p.current_output_mw != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }}>
                    · {p.current_output_mw} MW
                  </span>
                )}
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
              color: ecoColor(p.eco_score), flexShrink: 0,
            }}>
              {p.eco_grade}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
