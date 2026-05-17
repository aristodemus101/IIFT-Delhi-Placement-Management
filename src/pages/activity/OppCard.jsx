import React, { useState } from 'react'
import { Trash2, ChevronRight, Briefcase, Trophy, FlaskConical, GraduationCap, CalendarClock } from 'lucide-react'
import { Btn, Badge } from '../../components/UI'

const TYPE_META = {
  'SIP Hiring':   { icon: GraduationCap, color: 'green'  },
  'Hiring':       { icon: Briefcase,     color: 'blue'   },
  'Live Project': { icon: FlaskConical,  color: 'purple' },
  'Event':        { icon: CalendarClock, color: 'gray'   },
}

export const VIA_OPTIONS = ['', 'Case Comp', 'PPO', 'Hackathon', 'Referral', 'Direct']

export const TYPES = Object.keys(TYPE_META)
export const BATCH_COLOR = { final: 'blue', summer: 'amber', both: 'gray' }
export const BATCH_LABEL = { final: 'Final', summer: 'Summer', both: 'Both' }
export const STATUS_COLOR = { open: 'green', shortlisted: 'amber', interviewing: 'blue', closed: 'gray' }
export const STATUS_LABEL = { open: 'Open', shortlisted: 'Shortlisted', interviewing: 'Interviewing', closed: 'Closed' }
export const typeColor = t => TYPE_META[t]?.color || 'gray'
export function TypeIcon({ type, size = 13 }) {
  const Icon = TYPE_META[type]?.icon || Briefcase
  return <Icon size={size} />
}

export default function OppCard({ opp, isAdmin, onOpen, onDelete }) {
  const ap = opp.applicability || 'both'
  const dateStr = opp.createdAt?.toDate
    ? opp.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : ''

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${opp.title}"?`)) return
    await onDelete()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 3, background: `var(--${typeColor(opp.type) === 'gray' ? 'border' : typeColor(opp.type) + '-border'})` }} />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{opp.title || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{opp.organization || '—'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
            {(opp.stipend || opp.ctc) && (
              <div style={{ fontSize: 13, fontWeight: 700 }}>{opp.stipend || opp.ctc}</div>
            )}
            {opp.duration && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{opp.duration}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge color={typeColor(opp.type)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <TypeIcon type={opp.type} size={10} />{opp.type || 'Other'}
            </span>
          </Badge>
          <Badge color={BATCH_COLOR[ap]}>{BATCH_LABEL[ap] || ap}</Badge>
          {opp.via && <Badge color="amber">{opp.via}</Badge>}
          <Badge color={STATUS_COLOR[opp.status] || 'gray'}>{STATUS_LABEL[opp.status] || opp.status}</Badge>
          {opp.location && <Badge color="gray">{opp.location}</Badge>}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{dateStr}</span>
        </div>

        {opp.roles?.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {opp.roles.slice(0, 2).join(' · ')}{opp.roles.length > 2 ? ` +${opp.roles.length - 2}` : ''}
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
