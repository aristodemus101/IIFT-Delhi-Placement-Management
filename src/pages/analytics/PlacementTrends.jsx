import React, { useMemo, useState } from 'react'
import { useStudentsContext } from '../../lib/StudentsContext'
import { useBatch } from '../../lib/BatchContext'
import { cohortLabel } from '../../lib/batch'
import { Badge, Spinner } from '../../components/UI'
import {
  extractPlacementEvents, buildTimeline, cumulativeSeries,
  buildHeatmapMatrix, buildTally, bucketLabel, projectCompletion,
} from '../../lib/placementTrends'

const COHORT_COLORS = ['#1d4ed8', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316']

function colorFor(cohort, allCohorts) {
  const idx = allCohorts.indexOf(cohort)
  return COHORT_COLORS[idx % COHORT_COLORS.length]
}

export default function PlacementTrends() {
  const { students, loading } = useStudentsContext()
  const { activeBatches } = useBatch()

  const allCohortIds = useMemo(() => {
    const set = new Set(students.map(s => s.cohort).filter(Boolean))
    return [...set].sort()
  }, [students])

  const [selectedCohorts, setSelectedCohorts] = useState([])
  const [cycle, setCycle] = useState('all')       // all | summer | final
  const [granularity, setGranularity] = useState('week') // week | month
  const [cumulative, setCumulative] = useState(true)

  const toggleCohort = (id) => {
    setSelectedCohorts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const activeCohorts = selectedCohorts.length ? selectedCohorts : allCohortIds

  const events = useMemo(() => extractPlacementEvents(students, { cycle }), [students, cycle])

  const { buckets, series } = useMemo(
    () => buildTimeline(events, { granularity, cohorts: activeCohorts }),
    [events, granularity, activeCohorts]
  )

  const displaySeries = useMemo(
    () => (cumulative ? cumulativeSeries(series) : series),
    [series, cumulative]
  )

  const { matrix, max: heatMax } = useMemo(
    () => buildHeatmapMatrix(events, { granularity, cohorts: activeCohorts }),
    [events, granularity, activeCohorts]
  )

  const tally = useMemo(() => buildTally(events, { cohorts: activeCohorts }), [events, activeCohorts])

  // Cohort sizes for projection (total students per cohort, regardless of placement)
  const cohortSizes = useMemo(() => {
    const m = {}
    students.forEach(s => { if (s.cohort) m[s.cohort] = (m[s.cohort] || 0) + 1 })
    return m
  }, [students])

  const projections = useMemo(() => {
    return activeCohorts.map(cohort => {
      const cum = cumulativeSeries({ [cohort]: series[cohort] || [] })[cohort] || []
      const proj = projectCompletion(cum, cohortSizes[cohort])
      return { cohort, placed: cum[cum.length - 1] || 0, total: cohortSizes[cohort] || 0, proj }
    }).filter(p => p.total > 0)
  }, [activeCohorts, series, cohortSizes])

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Filters */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Batches</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 480 }}>
            <button onClick={() => setSelectedCohorts([])} style={{ ...pillStyle, ...(selectedCohorts.length === 0 ? pillActive : {}) }}>
              All ({allCohortIds.length})
            </button>
            {allCohortIds.map(id => {
              const active = selectedCohorts.includes(id)
              const color = colorFor(id, allCohortIds)
              return (
                <button key={id} onClick={() => toggleCohort(id)} style={{
                  ...pillStyle,
                  ...(active ? { background: `${color}22`, color, border: `1px solid ${color}88` } : {}),
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', marginRight: 4 }} />
                  {cohortLabel(id)}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Cycle</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'All'], ['summer', 'Summer'], ['final', 'Final']].map(([val, label]) => (
              <button key={val} onClick={() => setCycle(val)} style={{ ...pillStyle, ...(cycle === val ? pillActive : {}) }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Granularity</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['week', 'Week'], ['month', 'Month']].map(([val, label]) => (
              <button key={val} onClick={() => setGranularity(val)} style={{ ...pillStyle, ...(granularity === val ? pillActive : {}) }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>View</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[[true, 'Cumulative'], [false, 'Per-bucket']].map(([val, label]) => (
              <button key={label} onClick={() => setCumulative(val)} style={{ ...pillStyle, ...(cumulative === val ? pillActive : {}) }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 24px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexWrap: 'wrap' }}>
        <Badge color="green">{tally.totalEvents} placements</Badge>
        <Badge color="blue">{activeCohorts.length} batches shown</Badge>
        <Badge color="gray">{buckets.length} {granularity === 'week' ? 'weeks' : 'months'} of data</Badge>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          No placement data yet for the selected filters.
        </div>
      ) : (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <TrendChart buckets={buckets} series={displaySeries} granularity={granularity} allCohorts={allCohortIds} cumulative={cumulative} />
          <Heatmap buckets={buckets} matrix={matrix} max={heatMax} granularity={granularity} />
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <TallyPanel tally={tally} cohortSizes={cohortSizes} activeCohorts={activeCohorts} allCohorts={allCohortIds} />
            <ProjectionPanel projections={projections} granularity={granularity} allCohorts={allCohortIds} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trend line chart (inline SVG) ──────────────────────────────────────────────

function TrendChart({ buckets, series, granularity, allCohorts, cumulative }) {
  const width = 900, height = 260, padL = 44, padR = 16, padT = 16, padB = 36
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const cohorts = Object.keys(series)
  const allValues = cohorts.flatMap(c => series[c])
  const maxY = Math.max(1, ...allValues)

  const xStep = buckets.length > 1 ? innerW / (buckets.length - 1) : 0
  const yFor = (v) => padT + innerH - (v / maxY) * innerH
  const xFor = (i) => padL + i * xStep

  // Show at most ~14 x-axis labels to avoid crowding
  const labelStride = Math.max(1, Math.ceil(buckets.length / 14))

  return (
    <div>
      <SectionTitle>{cumulative ? 'Cumulative placements over time' : 'Placements per period'}</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ minWidth: width }}>
          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)}
              stroke="var(--border)" strokeWidth="1" />
          ))}
          {/* Y axis labels */}
          {[0, 0.5, 1].map(f => (
            <text key={f} x={padL - 8} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)">
              {Math.round(maxY * f)}
            </text>
          ))}
          {/* X axis labels */}
          {buckets.map((b, i) => (
            i % labelStride === 0 && (
              <text key={b} x={xFor(i)} y={height - 10} textAnchor="middle" fontSize="9" fill="var(--text-3)">
                {bucketLabel(b, granularity)}
              </text>
            )
          ))}
          {/* Lines */}
          {cohorts.map(cohort => {
            const color = colorFor(cohort, allCohorts)
            const pts = series[cohort].map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')
            return (
              <g key={cohort}>
                <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {series[cohort].map((v, i) => (
                  <circle key={i} cx={xFor(i)} cy={yFor(v)} r="2.5" fill={color}>
                    <title>{`${cohortLabel(cohort)} — ${bucketLabel(buckets[i], granularity)}: ${v}`}</title>
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {cohorts.map(cohort => (
          <div key={cohort} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
            <span style={{ width: 10, height: 2, background: colorFor(cohort, allCohorts), display: 'inline-block' }} />
            {cohortLabel(cohort)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Heatmap: cohort × bucket grid ──────────────────────────────────────────────

function Heatmap({ buckets, matrix, max, granularity }) {
  if (!matrix.length) return null
  const labelStride = Math.max(1, Math.ceil(buckets.length / 20))

  return (
    <div>
      <SectionTitle>Intensity heatmap — batch × {granularity}</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', padding: '4px 10px', textAlign: 'left', minWidth: 130, zIndex: 1 }} />
              {buckets.map((b, i) => (
                <th key={b} style={{ padding: '2px 1px', fontSize: 9, color: 'var(--text-3)', fontWeight: 500, writingMode: 'vertical-rl', textOrientation: 'mixed', minWidth: 18 }}>
                  {i % labelStride === 0 ? bucketLabel(b, granularity) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ cohort, values }) => (
              <tr key={cohort}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', padding: '4px 10px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {cohortLabel(cohort)}
                </td>
                {values.map((v, i) => {
                  const intensity = v / max
                  return (
                    <td key={i} title={`${cohortLabel(cohort)} · ${bucketLabel(buckets[i], granularity)}: ${v}`} style={{
                      width: 18, height: 18,
                      background: v === 0 ? 'var(--surface2)' : `color-mix(in srgb, var(--accent) ${Math.round(intensity * 90) + 10}%, var(--surface2))`,
                      border: '1px solid var(--surface)',
                    }} />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tally table ─────────────────────────────────────────────────────────────

function TallyPanel({ tally, cohortSizes, activeCohorts, allCohorts }) {
  const rows = Object.entries(tally.byCohort).sort((a, b) => b[1].total - a[1].total)

  return (
    <div style={{ flex: '1 1 340px', minWidth: 320 }}>
      <SectionTitle>Tally by batch</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={tallyHeadStyle}>Batch</th>
            <th style={{ ...tallyHeadStyle, textAlign: 'right' }}>SIP</th>
            <th style={{ ...tallyHeadStyle, textAlign: 'right' }}>Final</th>
            <th style={{ ...tallyHeadStyle, textAlign: 'right' }}>Total</th>
            <th style={{ ...tallyHeadStyle, textAlign: 'right' }}>% of batch</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([cohort, counts]) => {
            const size = cohortSizes[cohort] || 0
            const pct = size ? Math.round((counts.total / size) * 100) : 0
            return (
              <tr key={cohort} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...tallyCellStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(cohort, allCohorts), display: 'inline-block' }} />
                  {cohortLabel(cohort)}
                </td>
                <td style={{ ...tallyCellStyle, textAlign: 'right' }}>{counts.summer || 0}</td>
                <td style={{ ...tallyCellStyle, textAlign: 'right' }}>{counts.final || 0}</td>
                <td style={{ ...tallyCellStyle, textAlign: 'right', fontWeight: 700 }}>{counts.total}</td>
                <td style={{ ...tallyCellStyle, textAlign: 'right', color: pct >= 80 ? 'var(--green-text)' : pct >= 40 ? 'var(--amber-text)' : 'var(--text-3)' }}>{size ? `${pct}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <SectionTitle small>Top companies</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tally.topCompanies.map(([company, count]) => (
            <BarRow key={company} label={company} value={count} max={tally.topCompanies[0]?.[1] || 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BarRow({ label, value, max }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
      <div style={{ width: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-2)' }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 3, height: 12, position: 'relative' }}>
        <div style={{ width: `${pct}%`, background: 'var(--accent)', height: '100%', borderRadius: 3 }} />
      </div>
      <div style={{ width: 22, textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ── Projection panel ─────────────────────────────────────────────────────────

function ProjectionPanel({ projections, granularity, allCohorts }) {
  return (
    <div style={{ flex: '1 1 320px', minWidth: 300 }}>
      <SectionTitle>Velocity &amp; projection</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projections.map(({ cohort, placed, total, proj }) => {
          const pct = total ? Math.round((placed / total) * 100) : 0
          return (
            <div key={cohort} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(cohort, allCohorts), display: 'inline-block' }} />
                <span style={{ fontWeight: 600, fontSize: 12 }}>{cohortLabel(cohort)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{placed}/{total} placed ({pct}%)</span>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 3, height: 6, marginBottom: 8 }}>
                <div style={{ width: `${Math.min(100, pct)}%`, background: colorFor(cohort, allCohorts), height: '100%', borderRadius: 3 }} />
              </div>
              {!proj ? (
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Not enough data to project.</div>
              ) : proj.bucketsToComplete === null ? (
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Placement pace has flattened — no forward projection.</div>
              ) : proj.bucketsToComplete === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--green-text)', fontWeight: 600 }}>Batch fully placed.</div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  At current pace (~{proj.velocity.toFixed(1)}/{granularity}), full placement in
                  <strong style={{ color: 'var(--text)' }}> ~{proj.bucketsToComplete} {granularity === 'week' ? 'week' : 'month'}{proj.bucketsToComplete === 1 ? '' : 's'}</strong>.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────────────

function SectionTitle({ children, small }) {
  return (
    <div style={{ fontSize: small ? 11 : 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, textTransform: small ? 'uppercase' : 'none', letterSpacing: small ? '0.04em' : 0 }}>
      {children}
    </div>
  )
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }

const pillStyle = {
  padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text-2)',
  display: 'flex', alignItems: 'center', gap: 4,
  transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
  lineHeight: 1.6,
}
const pillActive = {
  background: 'var(--accent-bg)', color: 'var(--accent-dark)',
  border: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
}

const tallyHeadStyle = { padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }
const tallyCellStyle = { padding: '6px 8px', color: 'var(--text-2)' }
