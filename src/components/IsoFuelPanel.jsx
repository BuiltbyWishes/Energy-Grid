import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection'
import { getCacheResyncHours } from '../api/gridstatus'

// Vivid fuel palette — matches FuelMixPanel and plant types
const FUEL_COLORS = {
  solar:   '#F8C030',  // vivid warm gold
  wind:    '#40D8F0',  // vivid blue-teal
  nuclear: '#CC88FF',  // vivid violet
  hydro:   '#58A0F8',  // vivid steel blue
  gas:     '#F89040',  // vivid amber-orange
  coal:    '#8B9CB8',  // blue-slate (intentionally muted)
  battery: '#28E898',  // vivid emerald
  other:   '#6B7A94',  // muted slate
}

// ISO zone colors — blue tint family, resaturated
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
  caiso: 'CAISO',
  ercot: 'ERCOT',
  pjm:   'PJM',
  miso:  'MISO',
  spp:   'SPP',
  nyiso: 'NYISO',
  isone: 'ISO-NE',
}

const ISO_ORDER = ['caiso', 'ercot', 'pjm', 'miso', 'spp', 'nyiso', 'isone']

function fmtGW(mw) {
  if (!mw || mw <= 0) return '—'
  return `${(mw / 1000).toFixed(1)} GW`
}

function FuelBar({ fuelMix }) {
  const total = fuelMix.reduce((s, f) => s + f.mw, 0)
  if (!total) return null
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 6, marginBottom: 6 }}>
      {fuelMix.map(f => (
        <div
          key={f.fuel}
          style={{
            width: `${(f.mw / total) * 100}%`,
            background: FUEL_COLORS[f.fuel] ?? '#6B7A94',
            minWidth: f.mw / total > 0.02 ? 2 : 0,
          }}
        />
      ))}
    </div>
  )
}

function IsoRow({ iso, data }) {
  const [expanded, setExpanded] = useState(false)
  const color    = ISO_COLORS[iso] ?? 'var(--teal)'
  const label    = ISO_LABELS[iso] ?? iso.toUpperCase()
  const fuelMix  = data?.fuelMix ?? []
  const total    = fuelMix.reduce((s, f) => s + f.mw, 0)
  const dominant = fuelMix[0]
  const loadMw   = data?.load_mw

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Row header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* ISO name + color swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 1, background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', fontWeight: 500 }}>
            {label}
          </span>
        </div>

        {/* Load + dominant fuel + expand arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loadMw != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
              {fmtGW(loadMw)}
            </span>
          )}
          {dominant && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8,
              color: FUEL_COLORS[dominant.fuel] ?? 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {dominant.fuel}
            </span>
          )}
          <span style={{
            color: 'var(--text-dim)', fontSize: 9,
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            display: 'inline-block',
          }}>
            ›
          </span>
        </div>
      </div>

      {/* Expanded fuel breakdown */}
      {expanded && fuelMix.length > 0 && (
        <div style={{ padding: '0 16px 10px' }}>
          <FuelBar fuelMix={fuelMix} />
          {fuelMix.map(f => (
            <div key={f.fuel} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, marginTop: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: FUEL_COLORS[f.fuel] ?? '#6B7A94', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {f.fuel}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)' }}>
                  {total > 0 ? `${Math.round((f.mw / total) * 100)}%` : '—'}
                </span>
                <span style={{ color: 'var(--text)', width: 50, textAlign: 'right' }}>
                  {f.mw >= 1000 ? `${(f.mw / 1000).toFixed(1)}k` : f.mw} MW
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function IsoFuelPanel({ isoData = {} }) {
  const hasData      = Object.keys(isoData).length > 0
  const hasKey       = !!import.meta.env.VITE_GRIDSTATUS_API_KEY
  const resyncHours  = getCacheResyncHours()  // null if no cache

  // Badge shown in section header
  const badge = (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1,
      padding: '2px 7px', borderRadius: 999,
      background: hasData ? 'rgba(62,207,142,0.12)' : 'rgba(100,116,139,0.15)',
      color:      hasData ? 'var(--green)' : 'var(--text-dim)',
      border:     `1px solid ${hasData ? 'rgba(62,207,142,0.3)' : 'rgba(100,116,139,0.2)'}`,
    }}>
      {hasData
        ? `GS LIVE · resync ${resyncHours ?? '—'}h`
        : 'EIA ONLY'
      }
    </span>
  )

  return (
    <CollapsibleSection title="ISO Fuel Mix" defaultOpen={false} badge={badge}>
      {/* No key configured */}
      {!hasKey && (
        <div style={{
          padding: '14px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-dim)', lineHeight: 1.7,
        }}>
          {resyncHours != null
            ? `Live data resync in ${resyncHours} hrs`
            : 'Live fuel data not connected. Add VITE_GRIDSTATUS_API_KEY to enable real-time per-ISO fuel mix.'
          }
        </div>
      )}

      {/* Key configured but no data yet */}
      {hasKey && !hasData && (
        <div style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="loading-pulse" style={{ width: 6, height: 6 }} />
            Fetching GridStatus data…
          </div>
        </div>
      )}

      {/* ISO rows */}
      {hasData && ISO_ORDER.map(iso => {
        const data = isoData[iso]
        if (!data) return null
        return <IsoRow key={iso} iso={iso} data={data} />
      })}
    </CollapsibleSection>
  )
}
