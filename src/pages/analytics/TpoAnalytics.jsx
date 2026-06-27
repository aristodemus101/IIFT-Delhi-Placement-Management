import React, { useMemo, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { usePermissions } from '../../lib/usePermissions'
import { useMyTpoOutreach, useAllTpoOutreach, OUTREACH_STATUSES } from '../../lib/useTpoOutreach'
import { useBatch } from '../../lib/BatchContext'
import { cohortLabel } from '../../lib/batch'
import { Badge, Spinner, Select, StatCard } from '../../components/UI'

// ── KPI targets ───────────────────────────────────────────────────────────────

const T = {
  summer: {
    kpi1_newOrgs:   10,
    kpi1_gckkNew:   5,
    kpi3_intl:      2,
    kpi4_highValue: 15,
    kpi5_premium:   5,
    kpi6_lateral:   5,
    kpi7_gckk:      10,
  },
  final: {
    kpi1_newOrgs:             7,
    kpi1_multiCampus:         5,
    kpi2_avgCtc:              27,
    kpi2_minCtc:              16,
    kpi3_intl:                3,
    kpi4_highValue:           10,
    kpi4_minCtc:              30,
    kpi5_premium:             3,
    kpi5_minCtc:              50,
    kpi6_lateral:             15,
    kpi6_lateralHighCtc:      5,
    kpi6_lateralCtcThreshold: 27,
    kpi7_gckk:                20,
    kpi7_gckkPremium:         5,
  },
}

const GCKK_CAMPUSES = ['Gift City', 'Kakinada']
const HIGH_VALUE_SECTORS = [
  'Market Research & Consulting',
  'Banking',
  'FSI (Financial Services & Insurance)',
  'FMCG',
  'IT & ITES',
]

// ── KPI computation ───────────────────────────────────────────────────────────

function computeKpis(entries) {
  const s = entries.filter(e => e.season === 'summer')
  const f = entries.filter(e => e.season === 'final')
  const offers = (arr) => arr.filter(e => e.status === 'offer_made')
  const gckkEntries = (arr) => arr.filter(e => (e.campus || []).some(c => GCKK_CAMPUSES.includes(c)))

  const sOffers = offers(s)
  const fOffers = offers(f)

  // avg CTC of offer_made entries with a valid CTC
  const avgCtc = (arr) => {
    const vals = arr.map(e => e.ctc).filter(v => v != null && !isNaN(v))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  return {
    summer: {
      kpi1: {
        newOrgs:  s.filter(e => e.isNew).length,
        gckkNew:  gckkEntries(s).filter(e => e.isNew).length,
      },
      kpi2: {
        avgCtc: avgCtc(sOffers),
      },
      kpi3: {
        intl: sOffers.filter(e => e.isInternational).length,
      },
      kpi4: {
        highValue: sOffers.filter(e => HIGH_VALUE_SECTORS.includes(e.sector)).length,
      },
      kpi5: {
        premium: sOffers.filter(e => e.isPremium).length,
      },
      kpi6: {
        lateral: s.filter(e => e.isLateral).length,
      },
      kpi7: {
        gckk: gckkEntries(s).length,
      },
    },
    final: {
      kpi1: {
        newOrgs:     f.filter(e => e.isNew).length,
        multiCampus: f.filter(e => e.isMultiCampus).length,
      },
      kpi2: {
        avgCtc:  avgCtc(fOffers),
        minCtc:  fOffers.length ? Math.min(...fOffers.map(e => e.ctc).filter(v => v != null && !isNaN(v))) : null,
      },
      kpi3: {
        intl: fOffers.filter(e => e.isInternational).length,
      },
      kpi4: {
        highValue:   fOffers.filter(e => (e.ctc || 0) >= T.final.kpi4_minCtc).length,
      },
      kpi5: {
        premium:     fOffers.filter(e => e.isPremium).length,
        premiumHigh: fOffers.filter(e => e.isPremium && (e.ctc || 0) >= T.final.kpi5_minCtc).length,
      },
      kpi6: {
        lateral:     f.filter(e => e.isLateral).length,
        lateralHigh: f.filter(e => e.isLateral && (e.ctc || 0) >= T.final.kpi6_lateralCtcThreshold).length,
      },
      kpi7: {
        gckk:        gckkEntries(f).length,
        gckkPremium: gckkEntries(fOffers).filter(e => e.isPremium).length,
      },
    },
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function pct(actual, target) {
  return target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
}

function statusBadge(actual, target) {
  const p = pct(actual, target)
  if (p >= 100) return <Badge color="green">Met</Badge>
  if (p >= 60)  return <Badge color="amber">On Track</Badge>
  return <Badge color="red">Behind</Badge>
}

function ProgressBar({ actual, target, color }) {
  const p = pct(actual, target)
  const barColor = p >= 100 ? 'var(--green)' : p >= 60 ? 'var(--amber)' : 'var(--red, #ef4444)'
  return (
    <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', marginTop: 6, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${p}%`, background: barColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function KpiRow({ label, actual, target, format }) {
  const display = format ? format(actual) : actual
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--text-2)', flex: 1 }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 28, textAlign: 'right' }}>{display ?? '—'}</span>
      <span style={{ color: 'var(--text-3)' }}>/ {target}</span>
      {statusBadge(actual ?? 0, target)}
    </div>
  )
}

function SeasonCol({ title, color, children }) {
  return (
    <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: color === 'amber' ? 'var(--amber-bg)' : 'var(--accent-bg)', border: `1px solid ${color === 'amber' ? 'var(--amber-border, #fde68a)' : '#BFDBFE'}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: color === 'amber' ? 'var(--amber-text)' : 'var(--accent-text)', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function KpiDetailCard({ number, title, summerContent, finalContent }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 99, background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{number}</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: 12, display: 'flex', gap: 10 }}>
        {summerContent}
        {finalContent}
      </div>
    </div>
  )
}

// Top-row compact summary cards (one per KPI)
function KpiSummaryRow({ kpis }) {
  const { summer: s, final: f } = kpis

  const items = [
    {
      label: 'Corporate Engagement',
      sActual: s.kpi1.newOrgs, sTarget: T.summer.kpi1_newOrgs,
      fActual: f.kpi1.newOrgs, fTarget: T.final.kpi1_newOrgs,
    },
    {
      label: 'Compensation',
      sActual: s.kpi2.avgCtc != null ? +s.kpi2.avgCtc.toFixed(1) : null,
      sTarget: null,
      fActual: f.kpi2.avgCtc != null ? +f.kpi2.avgCtc.toFixed(1) : null,
      fTarget: T.final.kpi2_avgCtc,
      format: v => v != null ? `${v} L` : '—',
      fNoBar: true,
    },
    {
      label: 'International',
      sActual: s.kpi3.intl, sTarget: T.summer.kpi3_intl,
      fActual: f.kpi3.intl, fTarget: T.final.kpi3_intl,
    },
    {
      label: 'High Value Offers',
      sActual: s.kpi4.highValue, sTarget: T.summer.kpi4_highValue,
      fActual: f.kpi4.highValue, fTarget: T.final.kpi4_highValue,
    },
    {
      label: 'Premium / Dream',
      sActual: s.kpi5.premium, sTarget: T.summer.kpi5_premium,
      fActual: f.kpi5.premium, fTarget: T.final.kpi5_premium,
    },
    {
      label: 'Lateral',
      sActual: s.kpi6.lateral, sTarget: T.summer.kpi6_lateral,
      fActual: f.kpi6.lateral, fTarget: T.final.kpi6_lateral,
    },
    {
      label: 'GC / Kakinada',
      sActual: s.kpi7.gckk, sTarget: T.summer.kpi7_gckk,
      fActual: f.kpi7.gckk, fTarget: T.final.kpi7_gckk,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
      {items.map((item, i) => {
        const sPct = item.sTarget ? pct(item.sActual ?? 0, item.sTarget) : null
        const fPct = item.fTarget ? pct(item.fActual ?? 0, item.fTarget) : null
        const fmt = item.format || (v => v ?? '—')
        return (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, lineHeight: 1.3 }}>{item.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber-text)', textTransform: 'uppercase' }}>S</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{fmt(item.sActual)}</span>
                  {item.sTarget && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>/{item.sTarget}</span>}
                </div>
                {sPct != null && <ProgressBar actual={item.sActual ?? 0} target={item.sTarget} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-text)', textTransform: 'uppercase' }}>F</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{fmt(item.fActual)}</span>
                  {item.fTarget && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>/{item.fTarget}</span>}
                </div>
                {fPct != null && !item.fNoBar && <ProgressBar actual={item.fActual ?? 0} target={item.fTarget} />}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Full KPI detail cards
function KpiDetailSection({ kpis, canSeeFinancials }) {
  const { summer: s, final: f } = kpis

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px 24px' }}>

      <KpiDetailCard
        number={1} title="Corporate Outreach Engagement"
        summerContent={
          <SeasonCol title="Summer Internship" color="amber">
            <KpiRow label="New recruiting organisations" actual={s.kpi1.newOrgs} target={T.summer.kpi1_newOrgs} />
            <KpiRow label="New orgs for GC / Kakinada" actual={s.kpi1.gckkNew} target={T.summer.kpi1_gckkNew} />
          </SeasonCol>
        }
        finalContent={
          <SeasonCol title="Final Placement" color="accent">
            <KpiRow label="New recruiting organisations" actual={f.kpi1.newOrgs} target={T.final.kpi1_newOrgs} />
            <KpiRow label="Multi-campus recruiters" actual={f.kpi1.multiCampus} target={T.final.kpi1_multiCampus} />
          </SeasonCol>
        }
      />

      {canSeeFinancials && (
        <KpiDetailCard
          number={2} title="Compensation Benchmark"
          summerContent={
            <SeasonCol title="Summer Internship" color="amber">
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Avg stipend (offer_made entries)
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                  {s.kpi2.avgCtc != null ? `${s.kpi2.avgCtc.toFixed(2)} L` : '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>target ≥ ₹2.5L stipend</span>
              </div>
            </SeasonCol>
          }
          finalContent={
            <SeasonCol title="Final Placement" color="accent">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Avg CTC (offer_made entries)</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {f.kpi2.avgCtc != null ? `${f.kpi2.avgCtc.toFixed(2)} LPA` : '—'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>target ≥ {T.final.kpi2_avgCtc} LPA</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Min offer floor: {T.final.kpi2_minCtc} LPA
                  {f.kpi2.minCtc != null && (
                    <span style={{ marginLeft: 8, fontWeight: 600, color: f.kpi2.minCtc >= T.final.kpi2_minCtc ? 'var(--green-text)' : 'var(--red-text)' }}>
                      (lowest: {f.kpi2.minCtc.toFixed(1)} LPA)
                    </span>
                  )}
                </div>
              </div>
            </SeasonCol>
          }
        />
      )}

      <KpiDetailCard
        number={3} title="International Opportunities"
        summerContent={
          <SeasonCol title="Summer Internship" color="amber">
            <KpiRow label="International internship offers" actual={s.kpi3.intl} target={T.summer.kpi3_intl} />
          </SeasonCol>
        }
        finalContent={
          <SeasonCol title="Final Placement" color="accent">
            <KpiRow label="International placement offers" actual={f.kpi3.intl} target={T.final.kpi3_intl} />
          </SeasonCol>
        }
      />

      <KpiDetailCard
        number={4} title="High Value Offers"
        summerContent={
          <SeasonCol title="Summer Internship" color="amber">
            <KpiRow label="Offers from Market Research & Consulting / Banking / FSI / FMCG / IT & ITES" actual={s.kpi4.highValue} target={T.summer.kpi4_highValue} />
          </SeasonCol>
        }
        finalContent={
          <SeasonCol title="Final Placement" color="accent">
            <KpiRow label={`Offers ≥ ${T.final.kpi4_minCtc} LPA`} actual={f.kpi4.highValue} target={T.final.kpi4_highValue} />
          </SeasonCol>
        }
      />

      <KpiDetailCard
        number={5} title="Premium / Dream Companies"
        summerContent={
          <SeasonCol title="Summer Internship" color="amber">
            <KpiRow label="Offers from premier recruiters (MBB / top banks / FMCG)" actual={s.kpi5.premium} target={T.summer.kpi5_premium} />
          </SeasonCol>
        }
        finalContent={
          <SeasonCol title="Final Placement" color="accent">
            <KpiRow label="Premium company offers" actual={f.kpi5.premium} target={T.final.kpi5_premium} />
            {canSeeFinancials && <KpiRow label={`Premium offers ≥ ${T.final.kpi5_minCtc} LPA`} actual={f.kpi5.premiumHigh} target={T.final.kpi5_premium} />}
          </SeasonCol>
        }
      />

      <KpiDetailCard
        number={6} title="Lateral Placement Development"
        summerContent={
          <SeasonCol title="Summer Internship" color="amber">
            <KpiRow label="Internship opps for work-ex candidates" actual={s.kpi6.lateral} target={T.summer.kpi6_lateral} />
          </SeasonCol>
        }
        finalContent={
          <SeasonCol title="Final Placement" color="accent">
            <KpiRow label="Lateral hiring opportunities" actual={f.kpi6.lateral} target={T.final.kpi6_lateral} />
            {canSeeFinancials && <KpiRow label={`Lateral offers ≥ ${T.final.kpi6_lateralCtcThreshold} LPA`} actual={f.kpi6.lateralHigh} target={T.final.kpi6_lateralHighCtc} />}
          </SeasonCol>
        }
      />

      <KpiDetailCard
        number={7} title="Gift City & Kakinada Campus Development"
        summerContent={
          <SeasonCol title="Summer Internship" color="amber">
            <KpiRow label="Internship opps for GC / Kakinada" actual={s.kpi7.gckk} target={T.summer.kpi7_gckk} />
          </SeasonCol>
        }
        finalContent={
          <SeasonCol title="Final Placement" color="accent">
            <KpiRow label="Placement opps for GC / Kakinada" actual={f.kpi7.gckk} target={T.final.kpi7_gckk} />
            <KpiRow label="Premium offers for GC / Kakinada" actual={f.kpi7.gckkPremium} target={T.final.kpi7_gckkPremium} />
          </SeasonCol>
        }
      />
    </div>
  )
}

// ── Own TPO analytics view ────────────────────────────────────────────────────

function TpoAnalyticsOwn() {
  const { activeBatches } = useBatch()
  const [cohortFilter, setCohortFilter] = useState('')
  const { entries, loading } = useMyTpoOutreach()
  const { canSeeFinancials } = usePermissions()

  const filtered = useMemo(() =>
    cohortFilter ? entries.filter(e => (e.cohorts || []).includes(cohortFilter)) : entries,
    [entries, cohortFilter]
  )

  const kpis = useMemo(() => computeKpis(filtered), [filtered])

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Cohort:</span>
        <Select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} style={{ width: 180, height: 28, fontSize: 12 }}>
          <option value="">All</option>
          {activeBatches.map(b => <option key={b.id} value={b.id}>{cohortLabel(b.id)}</option>)}
        </Select>
      </div>
      <KpiSummaryRow kpis={kpis} />
      <KpiDetailSection kpis={kpis} canSeeFinancials={canSeeFinancials} />
    </div>
  )
}

// ── FC / Admin analytics view ─────────────────────────────────────────────────

function TpoAnalyticsAll() {
  const { activeBatches } = useBatch()
  const [cohortFilter, setCohortFilter] = useState('')
  const [tpoFilter, setTpoFilter] = useState('')
  const { entries, profiles, loading, error } = useAllTpoOutreach()
  const { canSeeFinancials } = usePermissions()

  const tpoList = useMemo(() =>
    Object.entries(profiles)
      .map(([uid, p]) => ({ uid, name: p.displayName || uid }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [profiles]
  )

  const filtered = useMemo(() => entries.filter(e => {
    if (tpoFilter && e.tpoUid !== tpoFilter) return false
    if (cohortFilter && !(e.cohorts || []).includes(cohortFilter)) return false
    return true
  }), [entries, tpoFilter, cohortFilter])

  const kpis = useMemo(() => computeKpis(filtered), [filtered])

  const selectedTpoName = tpoFilter ? (profiles[tpoFilter]?.displayName || tpoFilter) : null

  if (loading) return <Spinner />

  if (error) return (
    <div style={{ padding: 32, color: 'var(--red-text)', fontSize: 13, lineHeight: 1.6 }}>
      <strong>Could not load TPO outreach data.</strong><br />
      {error.includes('index') || error.includes('Index')
        ? 'A Firestore collection group index is missing. Deploy firestore.indexes.json to fix this.'
        : error}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>TPO:</span>
        <Select value={tpoFilter} onChange={e => setTpoFilter(e.target.value)} style={{ width: 180, height: 28, fontSize: 12 }}>
          <option value="">All TPOs</option>
          {tpoList.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
        </Select>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Cohort:</span>
        <Select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} style={{ width: 170, height: 28, fontSize: 12 }}>
          <option value="">All</option>
          {activeBatches.map(b => <option key={b.id} value={b.id}>{cohortLabel(b.id)}</option>)}
        </Select>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>{filtered.length} entries</span>
      </div>

      {tpoFilter && (
        <div style={{ padding: '8px 24px', background: 'var(--accent-bg)', borderBottom: '1px solid #BFDBFE', fontSize: 13, color: 'var(--accent-text)', fontWeight: 600 }}>
          Showing KPIs for: {selectedTpoName}
        </div>
      )}

      <KpiSummaryRow kpis={kpis} />
      <KpiDetailSection kpis={kpis} canSeeFinancials={canSeeFinancials} />
    </div>
  )
}

export default function TpoAnalytics() {
  const { isTpo } = useAuth()
  return isTpo ? <TpoAnalyticsOwn /> : <TpoAnalyticsAll />
}
