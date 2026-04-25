// src/pages/DashboardPage.jsx
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudents } from '../lib/useStudents'
import { useBatch } from '../lib/BatchContext'
import { batchLabel, normalizeBatch } from '../lib/batch'
import { getVal } from '../lib/columns'
import { PageHeader, StatCard, Spinner, Badge, Btn } from '../components/UI'
import { Users, CheckSquare, BarChart2, ChevronDown, ChevronRight } from 'lucide-react'

export default function DashboardPage() {
  const { students, loading } = useStudents()
  const { selectedBatch } = useBatch()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState({
    category: true, gender: true, workex: true, age: true, companies: true,
  })
  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }))

  const summerStudents = useMemo(() => students.filter(s => normalizeBatch(s._batch) === 'summer'), [students])
  const finalStudents  = useMemo(() => students.filter(s => normalizeBatch(s._batch) === 'final'),  [students])
  const scoped         = useMemo(() => students.filter(s => normalizeBatch(s._batch) === selectedBatch), [students, selectedBatch])

  const stats = useMemo(() => {
    if (!scoped.length) return {}
    const active = scoped.filter(s => !s._placed)
    const placed = scoped.filter(s => s._placed)
    const cats   = scoped.map(s => parseFloat(getVal(s, 'cat'))).filter(Boolean)
    const wxs    = scoped.map(s => parseFloat(getVal(s, 'wx'))).filter(Boolean)
    const avgCat = cats.length ? (cats.reduce((a, b) => a + b, 0) / cats.length).toFixed(1) : '—'
    const avgWx  = wxs.length  ? Math.round(wxs.reduce((a, b) => a + b, 0) / wxs.length)    : '—'
    const placePct = scoped.length ? Math.round(placed.length / scoped.length * 100) : 0

    const genderOf = (s) => {
      const g = String(getVal(s, 'gender') || '').trim().toLowerCase()
      return g.startsWith('m') ? 'male' : g.startsWith('f') ? 'female' : 'other'
    }
    const initSplit = () => ({ total: 0, male: 0, female: 0, other: 0 })

    // ── category breakdown ──────────────────────────────────────────────────
    const catBreak = {}
    scoped.forEach(s => {
      const c = getVal(s, 'category') || 'Unknown'
      if (!catBreak[c]) catBreak[c] = { total: 0, ytp: initSplit(), placed: initSplit() }
      const status = s._placed ? 'placed' : 'ytp'
      const g = genderOf(s)
      catBreak[c].total += 1
      catBreak[c][status].total += 1
      catBreak[c][status][g]    += 1
    })

    // ── work experience ─────────────────────────────────────────────────────
    const wxDefs = [
      { key: '0-6',   label: '0-6 mo',   min: 0,  max: 6   },
      { key: '6-12',  label: '6-12 mo',  min: 6,  max: 12  },
      { key: '12-24', label: '12-24 mo', min: 12, max: 24  },
      { key: '24-36', label: '24-36 mo', min: 24, max: 36  },
      { key: '36+',   label: '36+ mo',   min: 36, max: Infinity },
    ]
    const workEx = wxDefs.reduce((acc, d) => { acc[d.key] = { ...d, total: 0, placed: 0, ytp: 0 }; return acc }, {})
    const wxKey  = (v) => {
      if (!Number.isFinite(v)) return null
      return v < 6 ? '0-6' : v < 12 ? '6-12' : v < 24 ? '12-24' : v < 36 ? '24-36' : '36+'
    }
    scoped.forEach(s => {
      const k = wxKey(parseFloat(getVal(s, 'wx')))
      if (!k) return
      workEx[k].total += 1
      s._placed ? workEx[k].placed++ : workEx[k].ytp++
    })

    // ── age distribution ────────────────────────────────────────────────────
    const ageDefs = [
      { key: '≤22', label: '≤ 22' },
      { key: '23',  label: '23'   },
      { key: '24',  label: '24'   },
      { key: '25',  label: '25'   },
      { key: '26',  label: '26'   },
      { key: '27+', label: '27+'  },
    ]
    const ageGroups = ageDefs.reduce((acc, d) => { acc[d.key] = { ...d, total: 0, placed: 0, ytp: 0 }; return acc }, {})
    const getAge = (s) => {
      const direct = parseFloat(getVal(s, 'age'))
      if (!isNaN(direct) && direct > 0) return Math.round(direct)
      const dob = getVal(s, 'dob')
      if (dob) {
        const birth = new Date(dob)
        if (!isNaN(birth.getTime())) {
          const now = new Date()
          let a = now.getFullYear() - birth.getFullYear()
          if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) a--
          return a
        }
      }
      return null
    }
    const ageKeyOf = (a) => {
      if (a == null) return null
      if (a <= 22) return '≤22'
      if (a <= 26) return String(a)
      return '27+'
    }
    const ageVals = []
    scoped.forEach(s => {
      const a = getAge(s)
      const k = ageKeyOf(a)
      if (!k) return
      ageVals.push(a)
      ageGroups[k].total += 1
      s._placed ? ageGroups[k].placed++ : ageGroups[k].ytp++
    })
    const avgAge = ageVals.length ? (ageVals.reduce((a, b) => a + b, 0) / ageVals.length).toFixed(1) : '—'

    // ── placed companies ────────────────────────────────────────────────────
    const companies = {}
    placed.forEach(s => {
      const c = s._placedCompany || 'Unknown'
      companies[c] = (companies[c] || 0) + 1
    })

    // ── status by gender ────────────────────────────────────────────────────
    const statusGender = {
      ytp:    { total: 0, male: 0, female: 0, other: 0 },
      placed: { total: 0, male: 0, female: 0, other: 0 },
    }
    scoped.forEach(s => {
      const st = s._placed ? 'placed' : 'ytp'
      const g  = genderOf(s)
      statusGender[st].total += 1
      statusGender[st][g]    += 1
    })

    return {
      total: scoped.length, active: active.length, placed: placed.length,
      avgCat, avgWx, placePct, catBreak, workEx, ageGroups, avgAge, companies, statusGender,
    }
  }, [scoped])

  // ── shared styles ──────────────────────────────────────────────────────────
  const barTrack = {
    height: 6,
    background: 'color-mix(in srgb, var(--surface2) 90%, #fff)',
    borderRadius: 999,
    overflow: 'hidden',
    display: 'flex',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)',
  }
  const seg = (color) => ({
    height: '100%',
    background: color,
    borderRadius: 999,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
    transition: 'width 0.3s ease',
  })
  const countPill = {
    display: 'inline-flex', alignItems: 'center', padding: '1px 7px',
    borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: 'color-mix(in srgb, var(--surface2) 75%, #fff)',
    color: 'var(--text-2)', border: '1px solid color-mix(in srgb, var(--border) 82%, #fff)',
  }
  const titleStyle = {
    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
    color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0,
  }

  // ── reusable helpers (called as functions, not JSX components) ─────────────
  const cardHeader = (id, title, summary) => (
    <div
      onClick={() => toggle(id)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
    >
      <h3 style={titleStyle}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {collapsed[id] && summary && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{summary}</span>
        )}
        {collapsed[id]
          ? <ChevronRight size={13} color="var(--text-3)" />
          : <ChevronDown  size={13} color="var(--text-3)" />}
      </div>
    </div>
  )

  const ytpBar = (placed, ytp, total) => (
    <div>
      <div style={barTrack}>
        <div style={{ width: `${total ? (placed / total) * 100 : 0}%`, ...seg('linear-gradient(90deg, var(--green) 0%, color-mix(in srgb,var(--green) 74%,#fff) 100%)') }} />
        <div style={{ width: `${total ? (ytp    / total) * 100 : 0}%`, ...seg('linear-gradient(90deg, var(--amber) 0%, color-mix(in srgb,var(--amber) 74%,#fff) 100%)') }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, fontWeight: 600 }}>
        <span style={{ color: 'var(--green-text)' }}>{placed} placed</span>
        <span style={{ color: 'var(--amber-text)' }}>{ytp} YTP</span>
      </div>
    </div>
  )

  const divider = { borderBottom: '1px solid color-mix(in srgb,var(--border) 40%,transparent)', paddingBottom: 10 }
  const card    = (extra = {}) => ({
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '14px 14px 12px',
    display: 'flex', flexDirection: 'column', gap: 0, ...extra,
  })

  if (loading) return <Spinner />

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Dashboard"
        subtitle={`${batchLabel(selectedBatch)} overview — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
      />
      <div style={{ padding: '14px 24px 18px' }}>

        {/* batch badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Badge color="amber">Summer {summerStudents.length}</Badge>
          <Badge color="blue">Final {finalStudents.length}</Badge>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
            Placed: Summer {summerStudents.filter(s => s._placed).length} · Final {finalStudents.filter(s => s._placed).length}
          </span>
        </div>

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 10, marginBottom: 14, textAlign: 'center' }}>
          <StatCard label="Total Candidates" value={stats.total    || 0}  sub="in database" />
          <StatCard label="Available"         value={stats.active   || 0}  sub="not yet placed"          color="var(--accent)" />
          <StatCard label="Placed"            value={stats.placed   || 0}  sub={`${stats.placePct || 0}% of batch`} color="var(--green)" />
          <StatCard label="Avg CAT %ile"      value={stats.avgCat  || '—'} sub="across batch" />
          <StatCard label="Avg Work Ex"       value={stats.avgWx ? `${stats.avgWx}mo` : '—'} sub="months" />
        </div>

        {/* detail cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, alignItems: 'start' }}>

          {/* ── Category Breakdown ── */}
          <div style={card()}>
            {cardHeader('category', 'Category Breakdown', `${Object.keys(stats.catBreak || {}).length} categories`)}
            {!collapsed.category && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(stats.catBreak || {}).sort((a, b) => b[1].total - a[1].total).map(([cat, data]) => (
                  <div key={cat} style={divider}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                      <span style={countPill}>{data.total}</span>
                    </div>
                    {ytpBar(data.placed.total, data.ytp.total, data.total)}
                  </div>
                ))}
                {!Object.keys(stats.catBreak || {}).length && <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-3)' }}>No data yet</p>}
              </div>
            )}
          </div>

          {/* ── Status by Gender ── */}
          <div style={card()}>
            {cardHeader('gender', 'Status by Gender', `${stats.statusGender?.placed?.total || 0} placed · ${stats.statusGender?.ytp?.total || 0} YTP`)}
            {!collapsed.gender && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['YTP', stats.statusGender?.ytp], ['Placed', stats.statusGender?.placed]].map(([label, data]) => (
                  <div key={label} style={divider}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{label}</span>
                      <span style={countPill}>{data?.total || 0}</span>
                    </div>
                    <div style={barTrack}>
                      <div style={{ width: `${data?.total ? data.male   / data.total * 100 : 0}%`, ...seg('linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb,var(--accent) 70%,#fff) 100%)') }} />
                      <div style={{ width: `${data?.total ? data.female / data.total * 100 : 0}%`, ...seg('linear-gradient(90deg, var(--amber)  0%, color-mix(in srgb,var(--amber)  70%,#fff) 100%)') }} />
                      <div style={{ width: `${data?.total ? data.other  / data.total * 100 : 0}%`, ...seg('linear-gradient(90deg, var(--text-3) 0%, color-mix(in srgb,var(--text-3) 68%,#fff) 100%)') }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, fontWeight: 600 }}>
                      <span style={{ color: 'var(--accent-dark)' }}>M {data?.male   || 0}</span>
                      <span style={{ color: 'var(--amber-text)'  }}>F {data?.female || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Work Experience ── */}
          <div style={card()}>
            {cardHeader('workex', 'Work Experience', stats.avgWx ? `Avg ${stats.avgWx} mo` : undefined)}
            {!collapsed.workex && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Average months</span>
                  <span style={{ fontSize: 34, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.03em' }}>{stats.avgWx || '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.workEx && Object.values(stats.workEx).map(b => (
                    <div key={b.key} style={divider}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{b.label}</span>
                        <span style={countPill}>{b.total}</span>
                      </div>
                      {ytpBar(b.placed, b.ytp, b.total)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Age Distribution ── */}
          <div style={card()}>
            {cardHeader('age', 'Age Distribution', stats.avgAge && stats.avgAge !== '—' ? `Avg ${stats.avgAge} yr` : undefined)}
            {!collapsed.age && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Average age</span>
                  <span style={{ fontSize: 34, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.03em' }}>{stats.avgAge || '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.ageGroups && Object.values(stats.ageGroups).map(g => (
                    <div key={g.key} style={divider}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{g.label}</span>
                        <span style={countPill}>{g.total}</span>
                      </div>
                      {ytpBar(g.placed, g.ytp, g.total)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Placements by Company ── */}
          <div style={card()}>
            {cardHeader('companies', 'Placements by Company', `${Object.keys(stats.companies || {}).length} companies`)}
            {!collapsed.companies && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(stats.companies || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([co, count]) => (
                  <div key={co} style={{ display: 'grid', gridTemplateColumns: '1fr 64px auto', gap: 10, alignItems: 'center', ...divider }}>
                    <span style={{ fontSize: 'var(--text-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co}</span>
                    <div style={barTrack}>
                      <div style={{ width: `${stats.placed ? (count / stats.placed) * 100 : 0}%`, ...seg('linear-gradient(90deg, var(--green) 0%, color-mix(in srgb,var(--green) 74%,#fff) 100%)') }} />
                    </div>
                    <span style={countPill}>{count}</span>
                  </div>
                ))}
                {!Object.keys(stats.companies || {}).length && <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-3)' }}>No placements yet</p>}
              </div>
            )}
          </div>

        </div>

        {/* quick actions */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
          <h3 style={{ ...titleStyle, marginBottom: 14 }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={() => navigate('/roster')}  style={{ gap: 8 }}><Users      size={14} /> View Roster</Btn>
            <Btn onClick={() => navigate('/placed')}  style={{ gap: 8 }}><CheckSquare size={14} /> View Placed</Btn>
            <Btn onClick={() => navigate('/remapper')} style={{ gap: 8 }}><BarChart2  size={14} /> Column Remapper</Btn>
          </div>
        </div>

      </div>
    </div>
  )
}
