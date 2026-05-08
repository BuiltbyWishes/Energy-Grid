import { useState } from 'react'

/**
 * Shared collapsible section wrapper for all sidebar panels.
 * Props:
 *   title       — section label (string)
 *   defaultOpen — start expanded? (bool, default true)
 *   badge       — optional React node rendered left of the chevron (e.g. a status pill)
 *   children    — panel body content
 */
export default function CollapsibleSection({ title, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section>
      <button
        className="section-title collapsible-header"
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {badge}
          <span
            style={{
              color: 'var(--text-dim)',
              fontSize: 13,
              display: 'inline-block',
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
              lineHeight: 1,
            }}
          >
            ›
          </span>
        </div>
      </button>

      {open && children}
    </section>
  )
}
