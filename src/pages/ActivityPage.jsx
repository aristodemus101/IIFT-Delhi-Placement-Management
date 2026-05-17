import React, { useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useStudents } from '../lib/useStudents'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useOpportunities, deleteOpportunity } from '../lib/useOpportunities'
import { PageHeader, Btn, Select, Spinner } from '../components/UI'
import { Plus } from 'lucide-react'
import OppCard, { TYPES } from './activity/OppCard'
import PostModal from './activity/PostModal'
import DetailModal from './activity/DetailModal'

export default function ActivityPage() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const { students } = useStudents()
  const { opportunities, loading } = useOpportunities()
  const { connected: sheetsConnected, createTracker, addStageTab } = useSheetsSync()
  const { propose } = usePendingChanges()

  const [typeFilter, setTypeFilter]     = useState('all')
  const [batchFilter, setBatchFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailOpp, setDetailOpp]       = useState(null)
  const [postOpen, setPostOpen]         = useState(false)

  const filtered = useMemo(() => opportunities.filter(o => {
    if (typeFilter !== 'all' && o.type !== typeFilter) return false
    if (batchFilter !== 'all') {
      const ap = o.applicability || 'both'
      if (ap !== 'both' && ap !== batchFilter) return false
    }
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    return true
  }), [opportunities, typeFilter, batchFilter, statusFilter])

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
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ height: 32, fontSize: 12 }}>
          <option value="all">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} style={{ height: 32, fontSize: 12 }}>
          <option value="all">All batches</option>
          <option value="final">Final</option>
          <option value="summer">Summer</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 32, fontSize: 12 }}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interviewing">Interviewing</option>
          <option value="closed">Closed</option>
        </Select>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 60, fontSize: 13 }}>
            {opportunities.length === 0
              ? 'No opportunities yet. Admins can post via the button above.'
              : 'No results match the current filters.'}
          </div>
        ) : (
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
          onClose={() => setDetailOpp(null)}
        />
      )}
    </div>
  )
}
