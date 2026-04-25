import { useState, useEffect } from 'react'
import { fetchRegionTimeseries } from '../api/eia'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

function fmtGW(mw) {
  if (mw == null || mw === 0) return '—'
  return `${(+mw / 1000).toFixed(1)} GW`
}

function fmtHour(period) {
  // period: "2026-04-24T14" → "14:00"
  if (!period) return ''
  const h = period.slice(-2)
  return `${h}:00`
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(8,18,45,0.95)', border: '1px solid rgba(59,130,246,0.25)',
      borderRadius: 4, padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 10,
    }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{fmtHour(label)}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.stroke, marginBottom: 2 }}>
          {p.name}: {fmtGW(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function DetailPanel({ region, regionData, onClose }) {
  const [series, setSeries]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setSeries([])
    fetchRegionTimeseries(region.id)
      .then(data => setSeries(data))
      .catch(() => setSeries([]))
      .finally(() => setLoading(false))
  }, [region.id])

  const current = regionData[region.id] ?? {}
  const demand  = current.demand ?? 0
  const netGen  = current.netGen  ?? 0
  const ratio   = demand > 0 ? netGen / demand : 0
  const statusColor = ratio >= 0.95 ? 'var(--green)' : ratio >= 0.80 ? 'var(--yellow)' : 'var(--red)'

  return (
    <div className="detail-panel panel-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: 1.5,
          }}>
            Region Detail
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--teal)', marginTop: 3 }}>
            {region.name}
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>✕ CLOSE</button>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {[
          { label: 'DEMAND',  value: fmtGW(demand),  color: 'var(--teal)' },
          { label: 'NET GEN', value: fmtGW(netGen),  color: 'var(--blue)' },
          { label: 'UTIL',    value: demand > 0 ? `${Math.round(ratio * 100)}%` : '—', color: statusColor },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: '10px 0', textAlign: 'center',
            borderRight: i < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: stat.color, marginTop: 3 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ padding: '14px 0 8px', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
          textTransform: 'uppercase', letterSpacing: 1, padding: '0 16px 10px',
        }}>
          24h Demand · Net Gen
        </div>

        {loading ? (
          <div style={{
            height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11,
          }}>
            <div className="loading-pulse" style={{ marginRight: 8 }} /> Loading…
          </div>
        ) : series.length === 0 ? (
          <div style={{
            height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11,
          }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={series} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="grad-demand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0EEADC" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0EEADC" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-netgen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="period"
                tickFormatter={fmtHour}
                tick={{ fill: '#334155', fontSize: 8, fontFamily: 'DM Mono, monospace' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={v => `${(+v / 1000).toFixed(0)}k`}
                tick={{ fill: '#334155', fontSize: 8, fontFamily: 'DM Mono, monospace' }}
                axisLine={false} tickLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="demand" name="Demand"
                stroke="#0EEADC" strokeWidth={1.5}
                fill="url(#grad-demand)" dot={false} activeDot={{ r: 3, fill: '#0EEADC' }}
              />
              <Area
                type="monotone" dataKey="netGen" name="Net Gen"
                stroke="#3B82F6" strokeWidth={1.5}
                fill="url(#grad-netgen)" dot={false} activeDot={{ r: 3, fill: '#3B82F6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, padding: '0 16px 14px',
        fontFamily: 'var(--font-mono)', fontSize: 9, flexShrink: 0,
      }}>
        {[['#0EEADC', 'DEMAND'], ['#3B82F6', 'NET GEN']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Region info footer */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)',
        textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        Click another region marker to switch · ESC to close
      </div>
    </div>
  )
}
