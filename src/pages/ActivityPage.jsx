import React, { useEffect, useMemo, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import { PageHeader, Btn, Badge, Modal, Select, Spinner } from '../components/UI'
import { Plus, Trash2, Briefcase, Trophy, FlaskConical, GraduationCap } from 'lucide-react'

const TYPE_META = {
  'Hiring':       { icon: Briefcase,    color: 'blue'   },
  'Case Comp':    { icon: Trophy,       color: 'amber'  },
  'Live Project': { icon: FlaskConical, color: 'purple' },
  'SIP Hiring':   { icon: GraduationCap,color: 'green'  },
}

const BATCH_COLOR = { final: 'blue', summer: 'amber', both: 'gray' }
const BATCH_LABEL = { final: 'Final', summer: 'Summer', both: 'Both' }

function typeColor(type) { return TYPE_META[type]?.color || 'gray' }
function TypeIcon({ type, size = 14 }) {
  const Icon = TYPE_META[type]?.icon || Briefcase
  return <Icon size={size} />
}

async function parseWithGemini(rawText, posterName) {
  const key = import.meta.env.VITE_GEMINI_KEY
  if (!key) throw new Error('VITE_GEMINI_KEY not set in .env.local')

  const prompt = `
You are a placement cell data extractor. Given freeform text about an opportunity, return ONLY valid JSON (no markdown, no explanation).

Required fields:
- title (string) — short opportunity title
- type (one of: "Hiring", "SIP Hiring", "Case Comp", "Live Project")
- organization (string) — company / college / organiser name
- applicability (one of: "final", "summer", "both") — which batch of MBA students this is for
- description (string) — concise summary ≤ 300 chars

Optional fields (include ONLY if clearly stated in the text):
- package (object with "amount" string and optionally "currency" string, e.g. {"amount":"18 LPA","currency":"INR"})
- duration (string, e.g. "2 months", "Full-time")
- deadline (string, ISO date or plain text)
- location (string)
- eligibility (string)
- link (string, URL if present)

Text:
${rawText}
`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}

export default function ActivityPage() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'

  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')

  const [postOpen, setPostOpen]     = useState(false)
  const [rawText, setRawText]       = useState('')
  const [parsed, setParsed]         = useState(null)
  const [parsing, setParsing]       = useState(false)
  const [parseErr, setParseErr]     = useState('')
  const [saving, setSaving]         = useState(false)

  const [detailItem, setDetailItem] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'opportunities'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, err => {
      console.error('opportunities error', err)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const types = useMemo(() => {
    const s = new Set(items.map(i => i.type || 'Other'))
    return Array.from(s).sort()
  }, [items])

  const filtered = useMemo(() => items.filter(item => {
    if (typeFilter !== 'all' && (item.type || 'Other') !== typeFilter) return false
    if (batchFilter !== 'all') {
      const ap = item.applicability || 'both'
      if (ap !== 'both' && ap !== batchFilter) return false
    }
    return true
  }), [items, typeFilter, batchFilter])

  const handleParse = async () => {
    if (!rawText.trim()) return
    setParsing(true)
    setParseErr('')
    setParsed(null)
    try {
      const result = await parseWithGemini(rawText, user?.displayName || 'Admin')
      setParsed(result)
    } catch (e) {
      setParseErr(e.message)
    }
    setParsing(false)
  }

  const handlePost = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'opportunities'), {
        ...parsed,
        rawText,
        posterName: user?.displayName || '',
        posterUid: user?.uid || '',
        posterEmail: user?.email || '',
        createdAt: serverTimestamp(),
      })
      setPostOpen(false)
      setRawText('')
      setParsed(null)
      setParseErr('')
    } catch (e) {
      setParseErr('Failed to save: ' + e.message)
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this opportunity?')) return
    await deleteDoc(doc(db, 'opportunities', id))
  }

  const resetPost = () => {
    setRawText('')
    setParsed(null)
    setParseErr('')
    setPostOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Activity"
        subtitle="Hiring, case competitions, and live projects posted by the placement committee"
        actions={isAdmin && (
          <Btn variant="primary" size="sm" onClick={() => setPostOpen(true)}>
            <Plus size={13} /> Post Opportunity
          </Btn>
        )}
      />

      {/* Filters */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ height: 34, fontSize: 12 }}>
          <option value="all">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} style={{ height: 34, fontSize: 12 }}>
          <option value="all">All batches</option>
          <option value="final">Final only</option>
          <option value="summer">Summer only</option>
          <option value="both">Both batches</option>
        </Select>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} opportunit{filtered.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 60, fontSize: 13 }}>
            {items.length === 0
              ? 'No opportunities posted yet. Admins can post via the button above.'
              : 'No opportunities match the current filters.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, alignItems: 'start' }}>
            {filtered.map(item => (
              <OpportunityCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onDelete={handleDelete}
                onView={() => setDetailItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Post modal */}
      <Modal open={postOpen} onClose={resetPost} title="Post Opportunity" width={660}>
        {!parsed ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.6 }}>
              Paste the opportunity details in any format — announcement text, email, PDF content, etc.
              Gemini will extract structured fields automatically.
            </p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste opportunity text here…&#10;&#10;e.g. Company XYZ is hiring summer interns for their analytics team. Stipend: ₹50,000/month. Duration: 2 months. Open to Summer batch students. Apply by 20 May."
              style={{
                width: '100%', minHeight: 180, border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'var(--surface2)',
                color: 'var(--text)', padding: 12, fontSize: 13, lineHeight: 1.6,
                resize: 'vertical', fontFamily: 'var(--font-sans)', marginBottom: 10,
              }}
            />
            {parseErr && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{parseErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={resetPost}>Cancel</Btn>
              <Btn variant="primary" onClick={handleParse} disabled={parsing || !rawText.trim()}>
                {parsing ? 'Parsing…' : 'Parse with Gemini →'}
              </Btn>
            </div>
          </>
        ) : (
          <ParsedPreview
            parsed={parsed}
            setParsed={setParsed}
            parseErr={parseErr}
            saving={saving}
            onBack={() => { setParsed(null); setParseErr('') }}
            onPost={handlePost}
          />
        )}
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title={detailItem?.title || 'Opportunity'} width={600}>
        {detailItem && <DetailView item={detailItem} />}
      </Modal>
    </div>
  )
}

function OpportunityCard({ item, isAdmin, onDelete, onView }) {
  const ap = item.applicability || 'both'
  const dateStr = item.createdAt?.toDate
    ? item.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 3 }}>
            {item.title || 'Untitled'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {item.organization || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {item.package?.amount && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.package.amount}</div>
          )}
          {item.duration && (
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.duration}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge color={typeColor(item.type)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <TypeIcon type={item.type} size={10} />
            {item.type || 'Other'}
          </span>
        </Badge>
        <Badge color={BATCH_COLOR[ap] || 'gray'}>{BATCH_LABEL[ap] || ap}</Badge>
        {item.location && <Badge color="gray">{item.location}</Badge>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{dateStr}</span>
      </div>

      {item.description && (
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {item.description.length > 180 ? item.description.slice(0, 180) + '…' : item.description}
        </div>
      )}

      {item.deadline && (
        <div style={{ fontSize: 11, color: 'var(--amber-text)', fontWeight: 600 }}>
          Deadline: {item.deadline}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
        <Btn size="sm" onClick={onView}>View Details</Btn>
        {item.link && (
          <Btn size="sm" variant="ghost" onClick={() => window.open(item.link, '_blank')}>
            Apply →
          </Btn>
        )}
        {isAdmin && (
          <button
            onClick={() => onDelete(item.id)}
            style={{
              marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: 4, borderRadius: 6, display: 'flex',
            }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function ParsedPreview({ parsed, setParsed, parseErr, saving, onBack, onPost }) {
  const fields = [
    { label: 'Title',        key: 'title' },
    { label: 'Type',         key: 'type' },
    { label: 'Organization', key: 'organization' },
    { label: 'Applicability',key: 'applicability' },
    { label: 'Package',      key: 'package', render: v => v?.amount ? `${v.amount}${v.currency ? ` (${v.currency})` : ''}` : '—' },
    { label: 'Duration',     key: 'duration' },
    { label: 'Deadline',     key: 'deadline' },
    { label: 'Location',     key: 'location' },
    { label: 'Eligibility',  key: 'eligibility' },
    { label: 'Link',         key: 'link' },
  ]

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
        Review what Gemini extracted. You can edit fields directly before posting.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {fields.map(({ label, key, render }) => {
          const val = parsed[key]
          if (val === undefined || val === null || val === '') return null
          const display = render ? render(val) : String(val)
          return (
            <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
              <span style={{ width: 100, flexShrink: 0, color: 'var(--text-3)', fontWeight: 600, paddingTop: 1 }}>{label}</span>
              {key === 'description' ? (
                <textarea
                  value={val}
                  onChange={e => setParsed(p => ({ ...p, [key]: e.target.value }))}
                  style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '6px 10px', fontSize: 13, resize: 'vertical', minHeight: 60, fontFamily: 'var(--font-sans)' }}
                />
              ) : (
                <input
                  value={display}
                  onChange={e => {
                    if (key === 'package') {
                      setParsed(p => ({ ...p, package: { ...p.package, amount: e.target.value } }))
                    } else {
                      setParsed(p => ({ ...p, [key]: e.target.value }))
                    }
                  }}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }}
                />
              )}
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
          <span style={{ width: 100, flexShrink: 0, color: 'var(--text-3)', fontWeight: 600, paddingTop: 1 }}>Description</span>
          <textarea
            value={parsed.description || ''}
            onChange={e => setParsed(p => ({ ...p, description: e.target.value }))}
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '6px 10px', fontSize: 13, resize: 'vertical', minHeight: 72, fontFamily: 'var(--font-sans)' }}
          />
        </div>
      </div>
      {parseErr && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{parseErr}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onBack}>← Edit Text</Btn>
        <Btn variant="primary" onClick={onPost} disabled={saving}>
          {saving ? 'Posting…' : 'Post Opportunity'}
        </Btn>
      </div>
    </>
  )
}

function DetailView({ item }) {
  const ap = item.applicability || 'both'
  const dateStr = item.createdAt?.toDate
    ? item.createdAt.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
    : ''

  const rows = [
    { label: 'Type',         value: item.type },
    { label: 'Organization', value: item.organization },
    { label: 'Applicable to',value: BATCH_LABEL[ap] || ap },
    { label: 'Package',      value: item.package?.amount },
    { label: 'Duration',     value: item.duration },
    { label: 'Location',     value: item.location },
    { label: 'Eligibility',  value: item.eligibility },
    { label: 'Deadline',     value: item.deadline },
    { label: 'Posted by',    value: item.posterName },
    { label: 'Posted on',    value: dateStr },
  ].filter(r => r.value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {item.description && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>{item.description}</p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 0', color: 'var(--text-3)', fontWeight: 600, width: 130, verticalAlign: 'top' }}>{label}</td>
              <td style={{ padding: '8px 0', color: 'var(--text)' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {item.link && (
        <Btn variant="primary" onClick={() => window.open(item.link, '_blank')}>
          Apply / Open Link →
        </Btn>
      )}
    </div>
  )
}
