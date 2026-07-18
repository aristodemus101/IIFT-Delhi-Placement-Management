import React from 'react'
import { Trash2, ChevronRight, Briefcase } from 'lucide-react'
import { Btn, Badge } from '../../components/UI'

import {
  ACTIVITY_TYPE_OPTIONS,
  VIA_OPTIONS,
  getActivityTypeMeta,
  normalizeActivityType,
  normalizeCampusEngagementSubtype,
} from '../../config/activityTaxonomy'

export const TYPES = ACTIVITY_TYPE_OPTIONS
export const BATCH_COLOR = { final: 'blue', summer: 'amber', both: 'gray' }
export const BATCH_LABEL = { final: 'Final', summer: 'Summer', both: 'Both' }
export const STATUS_COLOR = { open: 'green', shortlisted: 'amber', interviewing: 'blue', closed: 'gray' }
export const STATUS_LABEL = { open: 'Open', shortlisted: 'Shortlisted', interviewing: 'Interviewing', closed: 'Closed' }

// Pass via for backwards-compat with old docs (type='Hiring', via='Case Comp')
export const normalizeOpportunityType = (type, via) => normalizeActivityType(type, via)
export const typeColor = (type, via) => getActivityTypeMeta(type, via)?.color || 'gray'
export function TypeIcon({ type, via, size = 13 }) {
  const Icon = getActivityTypeMeta(type, via)?.icon || Briefcase
  return <Icon size={size} />
}

export default function OppCard({ opp, isAdmin, onOpen, onDelete }) {
  const ap = opp.applicability || 'both'
  const displayType = normalizeOpportunityType(opp.type, opp.via)
  const displaySubtype = displayType === 'Campus Engagement' ? normalizeCampusEngagementSubtype(opp.subtype) : ''
  const isCaseComp = displayType === 'Case Comp'
  const dateStr = opp.createdAt?.toDate
    ? opp.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : ''

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${opp.title}"?`)) return
    await onDelete()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 3, background: `var(--${typeColor(opp.type, opp.via) === 'gray' ? 'border' : typeColor(opp.type, opp.via) + '-border'})` }} />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{opp.title || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.organization || '—'}</div>
          </div>
          {opp.duration && (
            <div style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-3)' }}>{opp.duration}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge color={typeColor(opp.type, opp.via)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <TypeIcon type={opp.type} via={opp.via} size={10} />{displayType || 'Other'}
            </span>
          </Badge>
          {displaySubtype && <Badge color="gray">{displaySubtype}</Badge>}
          <Badge color={BATCH_COLOR[ap]}>{BATCH_LABEL[ap] || ap}</Badge>
          {/* Show via only on Hiring opps (PPO/Referral/Direct), not on Case Comp */}
          {!isCaseComp && opp.via && <Badge color="blue">{opp.via}</Badge>}
          {/* Round counter for Case Comps */}
          {isCaseComp && opp.currentRound > 0 && (
            <Badge color="blue">Round {opp.currentRound}</Badge>
          )}
          <Badge color={STATUS_COLOR[opp.status] || 'gray'}>{STATUS_LABEL[opp.status] || opp.status}</Badge>
          {opp.location && <Badge color="gray">{opp.location}</Badge>}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{dateStr}</span>
        </div>

        {/* Hiring: show roles */}
        {opp.roles?.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {opp.roles.slice(0, 2).join(' · ')}{opp.roles.length > 2 ? ` +${opp.roles.length - 2}` : ''}
          </div>
        )}

        {/* Case Comp: show tracks + prize */}
        {isCaseComp && (opp.tracks?.length > 0 || opp.prize || opp.team_size) && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {opp.tracks?.length > 0 && <span>{opp.tracks.join(' · ')}</span>}
            {opp.team_size && <span style={{ color: 'var(--text-3)' }}>{opp.team_size}</span>}
            {opp.prize && <span style={{ color: 'var(--amber-text)', fontWeight: 600 }}>{opp.prize}</span>}
          </div>
        )}

        {opp.description && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {opp.description.length > 160 ? opp.description.slice(0, 160) + '…' : opp.description}
          </div>
        )}

        {opp.deadline && (
          <div style={{ fontSize: 11, color: 'var(--amber-text)', fontWeight: 600 }}>Deadline: {opp.deadline}</div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <Btn size="sm" onClick={onOpen} style={{ flex: 1 }}>
            View & Manage <ChevronRight size={11} />
          </Btn>
          {isAdmin && (
            <button onClick={handleDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, borderRadius: 6, display: 'flex' }} title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
