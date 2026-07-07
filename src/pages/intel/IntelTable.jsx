import React, { useMemo, useState } from 'react'
import { Badge } from '../../components/UI'
import { ChevronDown, ChevronRight, MoreVertical } from 'lucide-react'

// ── Styles ────────────────────────────────────────────────────────────────────

const thStyle = {
  textAlign: 'left', padding: '8px 14px', fontSize: 10.5, fontWeight: 700,
  color: 'var(--text-3)', background: 'color-mix(in srgb, var(--surface2) 85%, transparent)',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  textTransform: 'uppercase', letterSpacing: '0.06em', userSelect: 'none',
}

const IIFT_STATUS_CONFIG = {
  at_iift: { label: 'At IIFT', color: 'green' },
  gap:     { label: 'IIFT Gap', color: 'amber' },
}

const CYCLE_COLOR = { Finals: 'blue', Summer: 'amber', Lateral: 'gray' }

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function normalise(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function groupByCompany(records) {
  const map = new Map()
  for (const r of records) {
    // Group by normalised recruiterName so that records with the same display
    // name but different recruiterId values (data entry inconsistency) merge
    // into one group instead of splitting into duplicates.
    const key = normalise(r.recruiterName) || r.recruiterId || '?'
    if (!map.has(key)) {
      map.set(key, {
        key,
        recruiterId:   r.recruiterId,
        recruiterName: r.recruiterName || '?',
        sector:        r.sector,
        _iiftStatus:   r._iiftStatus,
        records:       [],
      })
    }
    map.get(key).records.push(r)
  }
  // Sort within each group: year desc, cycle asc
  for (const g of map.values()) {
    g.records.sort((a, b) => (b.placementYear || 0) - (a.placementYear || 0) || (a.placementCycle || '').localeCompare(b.placementCycle || ''))
  }
  // Sort groups: at_iift first, then by name
  return [...map.values()].sort((a, b) => {
    if (a._iiftStatus !== b._iiftStatus) return a._iiftStatus === 'at_iift' ? -1 : 1
    return a.recruiterName.localeCompare(b.recruiterName)
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IntelTable({ records, onRowClick, contextMenu }) {
  const groups = useMemo(() => groupByCompany(records), [records])

  // Which groups are expanded. Default: expand all when ≤ 10 groups, else collapse
  const [expandedKeys, setExpandedKeys] = useState(() => {
    if (groups.length <= 10) return new Set(groups.map(g => g.key))
    return new Set()
  })

  const allExpanded = expandedKeys.size === groups.length
  const toggleAll = () => {
    if (allExpanded) setExpandedKeys(new Set())
    else setExpandedKeys(new Set(groups.map(g => g.key)))
  }

  const toggleGroup = key => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ minWidth: 860, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {/* Company column with expand-all toggle */}
            <th style={{ ...thStyle, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={toggleAll}
                  title={allExpanded ? 'Collapse all' : 'Expand all'}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px',
                    borderRadius: 4, color: 'var(--text-3)', display: 'flex', alignItems: 'center',
                  }}
                >
                  {allExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />
                  }
                </button>
                Company
              </div>
            </th>
            <th style={thStyle}>College</th>
            <th style={thStyle}>Year</th>
            <th style={thStyle}>Cycle</th>
            <th style={thStyle}>Program</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Offers</th>
            <th style={thStyle}>Compensation</th>
            <th style={thStyle}>IIFT</th>
            <th style={{ ...thStyle, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
            const isExpanded = expandedKeys.has(group.key)
            const status = IIFT_STATUS_CONFIG[group._iiftStatus] || IIFT_STATUS_CONFIG.gap
            const accentColor = sectorColor(group.sector)

            return (
              <React.Fragment key={group.key}>
                {/* ── Group header row ── */}
                <tr
                  style={{
                    borderTop: '1px solid var(--border)',
                    background: 'color-mix(in srgb, var(--surface2) 45%, transparent)',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleGroup(group.key)}
                >
                  {/* Company cell */}
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Chevron */}
                      <span style={{ color: 'var(--text-3)', display: 'flex', flexShrink: 0, transition: 'transform 0.15s ease', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                        <ChevronDown size={13} />
                      </span>
                      {/* Avatar */}
                      <span style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: accentColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#fff',
                      }}>
                        {group.recruiterName[0].toUpperCase()}
                      </span>
                      {/* Name */}
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                        {group.recruiterName}
                      </span>
                      {/* Appearance count pill */}
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)',
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '1px 7px', fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}>
                        {group.records.length}
                      </span>
                    </div>
                  </td>
                  {/* Sector spans college + year columns */}
                  <td
                    colSpan={2}
                    style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}
                    onClick={e => { e.stopPropagation(); onRowClick(group.records[0]) }}
                  >
                    {group.sector
                      ? <Badge color="gray">{group.sector}</Badge>
                      : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                  </td>
                  {/* Empty cells for remaining columns */}
                  <td /><td /><td /><td />
                  {/* IIFT status */}
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <Badge color={status.color}>{status.label}</Badge>
                  </td>
                  <td />
                </tr>

                {/* ── Sub-rows (appearances) ── */}
                {isExpanded && group.records.map((r, i) => (
                  <tr
                    key={r._id}
                    style={{
                      borderBottom: i === group.records.length - 1 ? '1px solid color-mix(in srgb, var(--border) 60%, transparent)' : '1px solid color-mix(in srgb, var(--border) 35%, transparent)',
                      cursor: 'pointer',
                    }}
                    onClick={() => onRowClick(r)}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'color-mix(in srgb, var(--surface2) 55%, transparent)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '')}
                  >
                    {/* Company cell — indent marker */}
                    <td style={{ padding: '8px 14px 8px 48px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block', width: 3, height: 3, borderRadius: '50%',
                        background: 'var(--text-3)', verticalAlign: 'middle', marginRight: 6,
                        opacity: 0.5,
                      }} />
                    </td>
                    {/* College */}
                    <td style={{ padding: '8px 14px', fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500 }}>{r.collegeName || '—'}</span>
                      {r.campus
                        ? <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {r.campus}</span>
                        : null}
                    </td>
                    {/* Year */}
                    <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                      {r.placementYear || '—'}
                    </td>
                    {/* Cycle */}
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {r.placementCycle
                        ? <Badge color={CYCLE_COLOR[r.placementCycle] || 'gray'}>{r.placementCycle}</Badge>
                        : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                    </td>
                    {/* Program */}
                    <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {r.program || '—'}
                    </td>
                    {/* Role */}
                    <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.rolesMentioned || '—'}
                    </td>
                    {/* Offers */}
                    <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: r.numberOfOffers ? 600 : 400, color: r.numberOfOffers ? 'var(--text)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r.numberOfOffers ?? '—'}
                    </td>
                    {/* Compensation */}
                    <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: r.compensation ? 600 : 400, color: r.compensation ? 'var(--text)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {r.compensation || '—'}
                    </td>
                    {/* IIFT — empty, shown on group header only */}
                    <td />
                    {/* Context menu */}
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => contextMenu(e, r)}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: 'var(--text-3)', padding: '3px 5px', borderRadius: 6,
                          display: 'flex', alignItems: 'center',
                        }}
                        title="Options"
                      >
                        <MoreVertical size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
