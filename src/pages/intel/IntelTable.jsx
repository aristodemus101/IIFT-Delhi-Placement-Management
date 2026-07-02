import React from 'react'
import { Badge, Btn } from '../../components/UI'
import { ExternalLink, MoreVertical } from 'lucide-react'

const thStyle = {
  textAlign: 'left', padding: '9px 14px', fontSize: 10.5, fontWeight: 700,
  color: 'var(--text-3)', background: 'color-mix(in srgb, var(--surface2) 85%, transparent)',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  textTransform: 'uppercase', letterSpacing: '0.06em', userSelect: 'none',
}

const IIFT_STATUS_CONFIG = {
  at_iift: { label: 'At IIFT',   color: 'green' },
  gap:     { label: 'IIFT Gap',  color: 'amber' },
}

const CYCLE_COLOR = { Finals: 'blue', Summer: 'amber', Lateral: 'gray' }

export default function IntelTable({ records, onRowClick, contextMenu }) {
  return (
    <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Company</th>
            <th style={thStyle}>College</th>
            <th style={thStyle}>Year</th>
            <th style={thStyle}>Cycle</th>
            <th style={thStyle}>Program</th>
            <th style={thStyle}>Sector</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Offers</th>
            <th style={thStyle}>Compensation</th>
            <th style={thStyle}>IIFT</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => {
            const status = IIFT_STATUS_CONFIG[r._iiftStatus] || IIFT_STATUS_CONFIG.gap
            return (
              <tr
                key={r._id}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => onRowClick(r)}
                onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'color-mix(in srgb, var(--surface2) 70%, transparent)')}
                onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '')}
              >
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', maxWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: sectorColor(r.sector),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: '#fff',
                    }}>
                      {(r.recruiterName || '?')[0].toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.recruiterName || '—'}
                      </div>
                      {r.alias && r.alias !== r.recruiterName && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.alias}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {r.collegeName || '—'}
                  {r.campus ? <span style={{ color: 'var(--text-3)' }}> · {r.campus}</span> : null}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {r.placementYear || '—'}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {r.placementCycle
                    ? <Badge color={CYCLE_COLOR[r.placementCycle] || 'gray'}>{r.placementCycle}</Badge>
                    : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {r.program || '—'}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {r.sector
                    ? <Badge color="gray">{r.sector}</Badge>
                    : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.rolesMentioned || '—'}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: r.numberOfOffers ? 600 : 400, color: r.numberOfOffers ? 'var(--text)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {r.numberOfOffers ?? '—'}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: r.compensation ? 600 : 400, color: r.compensation ? 'var(--text)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>
                  {r.compensation || '—'}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <Badge color={status.color}>{status.label}</Badge>
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => contextMenu(e, r)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                    title="Options"
                  >
                    <MoreVertical size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Deterministic sector colour
export function sectorColor(sector) {
  const palette = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  ]
  if (!sector) return '#94a3b8'
  let hash = 0
  for (let i = 0; i < sector.length; i++) hash = sector.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}
