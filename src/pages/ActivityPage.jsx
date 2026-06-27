import React, { useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useStudents } from '../lib/useStudents'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useBatch } from '../lib/BatchContext'
import { useOpportunities, deleteOpportunity } from '../lib/useOpportunities'
import { PageHeader, Btn, Select, Spinner, Badge } from '../components/UI'
import { Plus, LayoutGrid, List, ChevronRight, Trash2, Download } from 'lucide-react'
import OppCard, { normalizeOpportunityType, typeColor, TypeIcon, BATCH_COLOR, BATCH_LABEL, STATUS_COLOR, STATUS_LABEL } from './activity/OppCard'
import PostModal from './activity/PostModal'
import DetailModal from './activity/DetailModal'
import { ACTIVITY_TYPE_OPTIONS } from '../config/activityTaxonomy'
import { exportToCSV, exportToExcel } from '../lib/csv'

function oppToRow(opp) {
  const date = (ts) => ts?.toDate ? ts.toDate().toISOString().slice(0, 10) : (ts || '')
  return {
    'Opportunity ID':  opp.id || '',
    'Title':           opp.title || '',
    'Type':            opp.type || '',
    'Subtype':         opp.subtype || '',
    'Via':             opp.via || '',
    'Organisation':    opp.organization || '',
    'Cycle':           BATCH_LABEL[opp.applicability || 'both'] || opp.applicability || '',
    'Status':          STATUS_LABEL[opp.status] || opp.status || '',
    'Roles':           Array.isArray(opp.roles) ? opp.roles.join(', ') : (opp.roles || ''),
    'Stipend':         opp.stipend || '',
    'CTC':             opp.ctc || '',
    'Duration':        opp.duration || '',
    'Location':        opp.location || '',
    'Deadline':        opp.deadline || '',
    'Eligibility':     opp.eligibility || '',
    'EOI Link':        opp.eoi_link || '',
    'Apply Link':      opp.apply_link || '',
    'Tracker Link':    opp.tracker_link || '',
    'Description':     opp.description || '',
    'Notes':           opp.notes || '',
    'Posted At':       date(opp.createdAt),
    'Updated At':      date(opp.updatedAt),
  }
}

const thStyle = {
  textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 600,
  color: 'var(--text-3)', background: 'color-mix(in srgb, var(--surface2) 85%, transparent)',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  textTransform: 'uppercase', letterSpacing: '0.04em', userSelect: 'none',
}

function ActivityTable({ opps, isAdmin, onOpen, onDelete }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Organisation</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Cycle</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Compensation</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Deadline</th>
            <th style={thStyle}>Posted</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {opps.map(opp => {
            const ap = opp.applicability || 'both'
            const dateStr = opp.createdAt?.toDate
              ? opp.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '—'
            const comp = opp.stipend || opp.ctc || '—'
            return (
              <tr key={opp.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => onOpen(opp)}
                onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'color-mix(in srgb, var(--surface2) 75%, transparent)')}
                onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '')}>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', maxWidth: 260 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{opp.title || 'Untitled'}</div>
                  {opp.roles?.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {opp.roles.slice(0, 2).join(' · ')}{opp.roles.length > 2 ? ` +${opp.roles.length - 2}` : ''}
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 12 }}>{opp.organization || '—'}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <Badge color={typeColor(opp.type)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <TypeIcon type={opp.type} size={10} />
                      {opp.via ? `${opp.type} · ${opp.via}` : opp.type}
                    </span>
                  </Badge>
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <Badge color={BATCH_COLOR[ap]}>{BATCH_LABEL[ap] || ap}</Badge>
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <Badge color={STATUS_COLOR[opp.status] || 'gray'}>{STATUS_LABEL[opp.status] || opp.status}</Badge>
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: comp !== '—' ? 600 : 400, color: comp !== '—' ? 'var(--text)' : 'var(--text-3)', fontSize: 12 }}>{comp}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-2)' }}>{opp.location || '—'}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 11, fontWeight: opp.deadline ? 600 : 400, color: opp.deadline ? 'var(--amber-text)' : 'var(--text-3)' }}>{opp.deadline || '—'}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-3)' }}>{dateStr}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Btn size="sm" variant="ghost" onClick={() => onOpen(opp)}>
                      View <ChevronRight size={11} />
                    </Btn>
                    {isAdmin && (
                      <button onClick={async () => {
                        if (!window.confirm(`Delete "${opp.title}"?`)) return
                        await onDelete(opp.id)
                      }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, borderRadius: 6, display: 'flex' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function ActivityPage() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const { students } = useStudents()
  const { opportunities, loading } = useOpportunities()
  const { connected: sheetsConnected, createTracker, addStageTab } = useSheetsSync()
  const { propose } = usePendingChanges()
  const { getCohortCycle } = useBatch()

  const [typeFilter, setTypeFilter]           = useState('all')
  const [applicabilityFilter, setApplicabilityFilter] = useState('all')
  const [statusFilter, setStatusFilter]       = useState('all')
  const [detailOpp, setDetailOpp]       = useState(null)
  const [postOpen, setPostOpen]         = useState(false)
  const [viewMode, setViewMode]         = useState('card') // 'card' | 'table'
  const [exportOpen, setExportOpen]     = useState(false)

  const filtered = useMemo(() => opportunities.filter(o => {
    if (typeFilter !== 'all' && normalizeOpportunityType(o.type) !== typeFilter) return false
    if (applicabilityFilter !== 'all') {
      const ap = o.applicability || 'both'
      if (ap !== applicabilityFilter) return false
    }
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    return true
  }), [opportunities, typeFilter, applicabilityFilter, statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Activity"
        subtitle="Opportunities posted by the placement committee"
        actions={isAdmin && (
          <Btn variant="primary" size="sm" onClick={() => setPostOpen(true)}>
            <Plus size={13} /> Post Opportunity
          </Btn>
        )}
      />

      <div style={{ padding: '10px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ height: 32, fontSize: 12, width: 'auto' }}>
          <option value="all">All types</option>
          {ACTIVITY_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={applicabilityFilter} onChange={e => setApplicabilityFilter(e.target.value)} style={{ height: 32, fontSize: 12, width: 'auto' }}>
          <option value="all">All cycles</option>
          <option value="summer">Summer only</option>
          <option value="final">Final only</option>
          <option value="both">Both cycles</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 32, fontSize: 12, width: 'auto' }}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interviewing">Interviewing</option>
          <option value="closed">Closed</option>
        </Select>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
        {/* Export */}
        <div style={{ position: 'relative' }}>
          <Btn size="sm" variant="ghost" onClick={() => setExportOpen(v => !v)} disabled={!filtered.length} title="Export filtered opportunities">
            <Download size={13} /> Export
          </Btn>
          {exportOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setExportOpen(false)} />
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', minWidth: 140, overflow: 'hidden' }}>
                <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  onClick={() => { exportToExcel(filtered.map(oppToRow), 'opportunities.xlsx'); setExportOpen(false) }}>
                  Excel (.xlsx)
                </button>
                <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  onClick={() => { exportToCSV(filtered.map(oppToRow), 'opportunities.csv'); setExportOpen(false) }}>
                  CSV (.csv)
                </button>
              </div>
            </>
          )}
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {[['card', LayoutGrid], ['table', List]].map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)} title={mode === 'card' ? 'Card view' : 'Table view'} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, border: 'none', cursor: 'pointer',
              background: viewMode === mode ? 'var(--accent-bg)' : 'var(--surface)',
              color: viewMode === mode ? 'var(--accent-dark)' : 'var(--text-3)',
            }}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: viewMode === 'table' ? 0 : '20px 28px' }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 60, fontSize: 13 }}>
            {opportunities.length === 0
              ? 'No opportunities yet. Admins can post via the button above.'
              : 'No results match the current filters.'}
          </div>
        ) : viewMode === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, alignItems: 'start' }}>
            {filtered.map(opp => (
              <OppCard
                key={opp.id}
                opp={opp}
                isAdmin={isAdmin}
                onOpen={() => setDetailOpp(opp)}
                onDelete={() => deleteOpportunity(opp.id)}
              />
            ))}
          </div>
        ) : (
          <ActivityTable
            opps={filtered}
            isAdmin={isAdmin}
            onOpen={setDetailOpp}
            onDelete={id => deleteOpportunity(id)}
          />
        )}
      </div>

      {postOpen && (
        <PostModal user={user} onClose={() => setPostOpen(false)} />
      )}

      {detailOpp && (
        <DetailModal
          opp={detailOpp}
          isAdmin={isAdmin}
          user={user}
          students={students}
          sheetsConnected={sheetsConnected}
          createTracker={createTracker}
          addStageTab={addStageTab}
          propose={propose}
          getCohortCycle={getCohortCycle}
          onClose={() => setDetailOpp(null)}
        />
      )}
    </div>
  )
}
