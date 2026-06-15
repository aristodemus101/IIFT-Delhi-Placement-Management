import React, { useMemo, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { usePermissions } from '../../lib/usePermissions'
import { useMyTpoOutreach, useAllTpoOutreach, OUTREACH_STATUSES } from '../../lib/useTpoOutreach'
import { useBatch } from '../../lib/BatchContext'
import { cohortLabel } from '../../lib/batch'
import { Badge, Spinner, Select, StatCard } from '../../components/UI'

const STATUS_COLOR = {
  reached_out: 'gray',
  shortlisted: 'blue',
  offer_made:  'green',
  declined:    'red',
}

function avg(nums) {
  const valid = nums.filter(n => n != null && !isNaN(n))
  return valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length) : null
}

function fmt(n) {
  return n != null ? n.toFixed(2) : '—'
}

// Summary card row
function SummaryRow({ entries, canSeeFinancials }) {
  const totalCompanies  = new Set(entries.map(e => e.companyName.toLowerCase())).size
  const avgCtc          = avg(entries.map(e => e.ctc))
  const avgFixed        = avg(entries.map(e => e.fixedComponent))
  const offers          = entries.filter(e => e.status === 'offer_made').length
  const conversionRate  = entries.length ? Math.round((offers / entries.length) * 100) : 0

  return (
    <div style={{ display: 'flex', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <StatCard label="Companies Reached" value={totalCompanies} color="blue" />
      {canSeeFinancials && <StatCard label="Avg CTC (LPA)"   value={fmt(avgCtc)}   color="green" />}
      {canSeeFinancials && <StatCard label="Avg Fixed (LPA)" value={fmt(avgFixed)} color="amber" />}
      <StatCard label="Offers Made"        value={offers}        color="green" />
      <StatCard label="Offer Rate"         value={`${conversionRate}%`} color="gray" />
    </div>
  )
}

// Per-TPO breakdown table (admin / faculty_coordinator view)
function TpoBreakdownTable({ entries, profiles, cohortFilter, canSeeFinancials }) {
  const filtered = cohortFilter ? entries.filter(e => e.cohort === cohortFilter) : entries

  // Group by tpoUid
  const byTpo = useMemo(() => {
    const m = {}
    filtered.forEach(e => {
      if (!m[e.tpoUid]) m[e.tpoUid] = []
      m[e.tpoUid].push(e)
    })
    return m
  }, [filtered])

  const rows = Object.entries(byTpo).map(([uid, es]) => ({
    uid,
    name:       profiles[uid]?.displayName || uid,
    companies:  new Set(es.map(e => e.companyName.toLowerCase())).size,
    avgCtc:     avg(es.map(e => e.ctc)),
    avgFixed:   avg(es.map(e => e.fixedComponent)),
    offers:     es.filter(e => e.status === 'offer_made').length,
    total:      es.length,
  })).sort((a, b) => b.offers - a.offers)

  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        No outreach data for this cohort yet.
      </div>
    )
  }

  const headers = ['TPO', 'Companies', ...(canSeeFinancials ? ['Avg CTC (LPA)', 'Avg Fixed (LPA)'] : []), 'Offers', 'Total Entries', 'Offer Rate']

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.uid} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
              <td style={tdStyle}><strong>{r.name}</strong></td>
              <td style={tdStyle}>{r.companies}</td>
              {canSeeFinancials && <td style={tdStyle}>{fmt(r.avgCtc)}</td>}
              {canSeeFinancials && <td style={tdStyle}>{fmt(r.avgFixed)}</td>}
              <td style={tdStyle}>
                <Badge color="green">{r.offers}</Badge>
              </td>
              <td style={tdStyle}>{r.total}</td>
              <td style={tdStyle}>
                {r.total ? Math.round((r.offers / r.total) * 100) + '%' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Per-company breakdown table (own TPO view — scoped to their entries only)
function MyCompanyBreakdownTable({ entries, canSeeFinancials }) {
  const rows = useMemo(() => {
    const m = {}
    entries.forEach(e => {
      const key = e.companyName.toLowerCase()
      if (!m[key]) m[key] = { companyName: e.companyName, entries: [] }
      m[key].entries.push(e)
    })
    return Object.values(m).map(({ companyName, entries: es }) => ({
      companyName,
      roles:    [...new Set(es.map(e => e.roleTitle).filter(Boolean))].join(', ') || '—',
      avgCtc:   avg(es.map(e => e.ctc)),
      avgFixed: avg(es.map(e => e.fixedComponent)),
      bestStatus: OUTREACH_STATUSES.slice().reverse().find(s => es.some(e => e.status === s.value))?.value || 'reached_out',
      count:    es.length,
    })).sort((a, b) => a.companyName.localeCompare(b.companyName))
  }, [entries])

  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        No outreach data yet.
      </div>
    )
  }

  const headers = ['Company', 'Roles', ...(canSeeFinancials ? ['Avg CTC (LPA)', 'Avg Fixed (LPA)'] : []), 'Best Status', 'Entries']

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.companyName} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
              <td style={tdStyle}><strong>{r.companyName}</strong></td>
              <td style={{ ...tdStyle, color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.roles}</td>
              {canSeeFinancials && <td style={tdStyle}>{fmt(r.avgCtc)}</td>}
              {canSeeFinancials && <td style={tdStyle}>{fmt(r.avgFixed)}</td>}
              <td style={tdStyle}>
                <Badge color={STATUS_COLOR[r.bestStatus] || 'gray'}>
                  {OUTREACH_STATUSES.find(s => s.value === r.bestStatus)?.label || r.bestStatus}
                </Badge>
              </td>
              <td style={tdStyle}>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

function TpoAnalyticsOwn() {
  const { activeBatches } = useBatch()
  const [cohortFilter, setCohortFilter] = useState('')
  const { entries, loading } = useMyTpoOutreach()
  const { canSeeFinancials } = usePermissions()

  if (loading) return <Spinner />
  const filtered = cohortFilter ? entries.filter(e => e.cohort === cohortFilter) : entries

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Cohort:</span>
        <Select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} style={{ width: 180, height: 28, fontSize: 12 }}>
          <option value="">All</option>
          {activeBatches.map(b => <option key={b.id} value={b.id}>{cohortLabel(b.id)}</option>)}
        </Select>
      </div>
      <SummaryRow entries={filtered} canSeeFinancials={canSeeFinancials} />
      <div style={{ padding: '16px 24px 8px', fontWeight: 600, fontSize: 13, color: 'var(--text-2)' }}>Company Breakdown</div>
      <MyCompanyBreakdownTable entries={filtered} canSeeFinancials={canSeeFinancials} />
    </div>
  )
}

function TpoAnalyticsAll() {
  const { activeBatches } = useBatch()
  const [cohortFilter, setCohortFilter] = useState('')
  const { entries, profiles, loading } = useAllTpoOutreach()
  const { canSeeFinancials } = usePermissions()

  if (loading) return <Spinner />
  const filtered = cohortFilter ? entries.filter(e => e.cohort === cohortFilter) : entries

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Cohort:</span>
        <Select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} style={{ width: 180, height: 28, fontSize: 12 }}>
          <option value="">All</option>
          {activeBatches.map(b => <option key={b.id} value={b.id}>{cohortLabel(b.id)}</option>)}
        </Select>
      </div>
      <SummaryRow entries={filtered} canSeeFinancials={canSeeFinancials} />
      <div style={{ padding: '16px 24px 8px', fontWeight: 600, fontSize: 13, color: 'var(--text-2)' }}>Per-TPO Breakdown</div>
      <TpoBreakdownTable entries={filtered} profiles={profiles} cohortFilter={cohortFilter} canSeeFinancials={canSeeFinancials} />
    </div>
  )
}

export default function TpoAnalytics() {
  const { isTpo } = useAuth()
  return isTpo ? <TpoAnalyticsOwn /> : <TpoAnalyticsAll />
}

const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11,
  color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)', background: 'var(--surface)',
  position: 'sticky', top: 0, zIndex: 1,
}

const tdStyle = {
  padding: '8px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
}
