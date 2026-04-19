// src/pages/DashboardPage.jsx
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudents } from '../lib/useStudents'
import { getVal } from '../lib/columns'
import { PageHeader, StatCard, Spinner, Badge, Btn } from '../components/UI'
import { Users, CheckSquare, TrendingUp, BarChart2, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { students, loading } = useStudents()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    if (!students.length) return {}
    const active = students.filter(s => !s._placed)
    const placed = students.filter(s => s._placed)
    const cats = students.map(s => parseFloat(getVal(s, 'cat'))).filter(Boolean)
    const wxs = students.map(s => parseFloat(getVal(s, 'wx'))).filter(Boolean)
    const avgCat = cats.length ? (cats.reduce((a, b) => a + b, 0) / cats.length).toFixed(1) : '—'
    const avgWx = wxs.length ? Math.round(wxs.reduce((a, b) => a + b, 0) / wxs.length) : '—'
    const above90 = cats.filter(c => c >= 90).length
    const placePct = students.length ? Math.round(placed.length / students.length * 100) : 0

    // category breakdown
    const catBreak = {}
    students.forEach(s => {
      const c = getVal(s, 'category') || 'Unknown'
      catBreak[c] = (catBreak[c] || 0) + 1
    })

    // placed companies
    const companies = {}
    placed.forEach(s => {
      const c = s._placedCompany || 'Unknown'
      companies[c] = (companies[c] || 0) + 1
    })

    // gender
    const genders = {}
    students.forEach(s => {
      const g = getVal(s, 'gender') || 'Unknown'
      genders[g] = (genders[g] || 0) + 1
    })

    return { total: students.length, active: active.length, placed: placed.length, avgCat, avgWx, above90, placePct, catBreak, companies, genders }
  }, [students])

  if (loading) return <Spinner />

  return (
    <div style={{ flex: 1 }}>
      <PageHeader
        title="Dashboard"
        subtitle={`Batch overview — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
      />
      <div style={{ padding: '24px 28px' }}>
        {/* Main stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatCard label="Total Candidates" value={stats.total || 0} sub="in database" />
          <StatCard label="Available" value={stats.active || 0} sub="not yet placed" color="var(--accent)" />
          <StatCard label="Placed" value={stats.placed || 0} sub={`${stats.placePct || 0}% of batch`} color="var(--green)" />
          <StatCard label="Avg CAT %ile" value={stats.avgCat || '—'} sub="across batch" />
          <StatCard label="Avg Work Ex" value={stats.avgWx ? `${stats.avgWx}mo` : '—'} sub="months" />
          <StatCard label="CAT 90+ %ile" value={stats.above90 || 0} sub="students" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Category breakdown */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category Breakdown</h3>
            {Object.entries(stats.catBreak || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>{cat}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${stats.total ? count / stats.total * 100 : 0}%`, height: '100%', background: 'var(--text)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 20, textAlign: 'right' }}>{count}</span>
                </div>
              </div>
            ))}
            {!Object.keys(stats.catBreak || {}).length && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No data yet</p>}
          </div>

          {/* Gender */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gender Split</h3>
            {Object.entries(stats.genders || {}).sort((a, b) => b[1] - a[1]).map(([g, count]) => (
              <div key={g} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span>{g}</span>
                  <span style={{ color: 'var(--text-2)' }}>{count} ({stats.total ? Math.round(count / stats.total * 100) : 0}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${stats.total ? count / stats.total * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
            {!Object.keys(stats.genders || {}).length && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No data yet</p>}
          </div>

          {/* Placed companies */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Placements by Company</h3>
            {Object.entries(stats.companies || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([co, count]) => (
              <div key={co} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{co}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, background: 'var(--green-bg)', color: 'var(--green-text)',
                  border: '1px solid var(--green-border)', borderRadius: 12, padding: '1px 8px', marginLeft: 8
                }}>{count}</span>
              </div>
            ))}
            {!Object.keys(stats.companies || {}).length && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No placements yet</p>}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={() => navigate('/roster')} style={{ gap: 8 }}><Users size={14} /> View Roster</Btn>
            <Btn onClick={() => navigate('/placed')} style={{ gap: 8 }}><CheckSquare size={14} /> View Placed</Btn>
            <Btn onClick={() => navigate('/remapper')} style={{ gap: 8 }}><BarChart2 size={14} /> Column Remapper</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
