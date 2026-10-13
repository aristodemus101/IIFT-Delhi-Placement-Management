import React, { useMemo, useState } from 'react'
import { PageHeader, Btn, Badge, Spinner, Modal } from '../components/UI'
import { usePermissions } from '../lib/usePermissions'
import { useOutreachContacts, useApolloUsage, enrichContacts, todayKeyIST } from '../lib/useOutreach'
import { Sparkles, Mail, Phone, MapPin, ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react'

const DAILY_PHONE_BUDGET = 250 // mirror of the server-side cap, for display only

const CONFIDENCE_COLOR = { high: 'green', medium: 'amber', low: 'gray', none: 'red' }

function parseUrls(text) {
  return text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean)
}

export default function OutreachPage() {
  const { canDo } = usePermissions()
  const canEnrich = canDo('enrichContacts')
  const { contacts, loading } = useOutreachContacts()
  const usage = useApolloUsage()

  const [urlText, setUrlText] = useState('')
  const [wantPhone, setWantPhone] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [search, setSearch] = useState('')

  const parsedUrls = useMemo(() => parseUrls(urlText), [urlText])
  const uniqueCount = useMemo(() => new Set(parsedUrls.map(u => u.toLowerCase().replace(/\/+$/, ''))).size, [parsedUrls])

  const phonesUsedToday = usage?.phoneByDay?.[todayKeyIST()] || 0
  const phonesRequestedToday = usage?.phoneRequestedByDay?.[todayKeyIST()] || 0
  const phonesCommittedToday = Math.max(phonesUsedToday, phonesRequestedToday)
  const phonesRemaining = Math.max(0, DAILY_PHONE_BUDGET - phonesCommittedToday)

  const worstCaseCredits = uniqueCount + (wantPhone ? Math.min(uniqueCount, phonesRemaining) * 8 : 0)

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  }, [contacts, search])

  const runEnrichment = async () => {
    setConfirmOpen(false)
    setBusy(true); setError(''); setResult(null)
    try {
      const data = await enrichContacts(parsedUrls, wantPhone)
      setResult(data)
      setUrlText('')
    } catch (e) {
      setError(e?.message || 'Enrichment failed.')
    } finally {
      setBusy(false)
    }
  }

  const copyEmail = (id, email) => {
    navigator.clipboard?.writeText(email).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Outreach" subtitle="Enrich LinkedIn profiles into contact details via Apollo" />

      {/* Usage tracker */}
      <div style={{ padding: '10px 24px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge color="blue">{contacts.length} contacts</Badge>
        <Badge color="gray">{usage?.emailCreditsLifetime || 0} email credits (lifetime)</Badge>
        <Badge color="gray">{usage?.phoneCreditsLifetime || 0} phone credits (lifetime)</Badge>
        <Badge color={phonesRemaining > 20 ? 'green' : phonesRemaining > 0 ? 'amber' : 'red'}>
          {phonesRemaining}/{DAILY_PHONE_BUDGET} phone reveals left today
        </Badge>
      </div>

      {!canEnrich && (
        <div style={{ margin: '12px 24px 0', padding: '9px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)' }}>
          You have read-only access to outreach contacts. Enrichment is restricted to admins and committee members.
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Input panel */}
        {canEnrich && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Paste LinkedIn profile URLs</div>
            <textarea
              value={urlText}
              onChange={e => setUrlText(e.target.value)}
              rows={5}
              placeholder={'https://www.linkedin.com/in/jane-doe\nhttps://www.linkedin.com/in/john-smith\n… (one per line, or comma/space separated)'}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface2)',
                color: 'var(--text)', fontSize: 13, resize: 'vertical',
                fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {uniqueCount} unique URL{uniqueCount === 1 ? '' : 's'} detected
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
                <input type="checkbox" checked={wantPhone} onChange={e => setWantPhone(e.target.checked)} disabled={phonesRemaining === 0} />
                Also reveal phone numbers (8 credits each, arrives async)
                {phonesRemaining === 0 && <span style={{ color: 'var(--red-text)', fontSize: 11 }}>— daily budget reached</span>}
              </label>
              <div style={{ marginLeft: 'auto' }}>
                <Btn variant="primary" disabled={uniqueCount === 0 || busy} onClick={() => setConfirmOpen(true)}>
                  <Sparkles size={13} /> {busy ? 'Enriching…' : 'Enrich'}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* Result / error banners */}
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)', borderRadius: 10, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        {result && (
          <div style={{ padding: '10px 14px', background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)', borderRadius: 10, fontSize: 13 }}>
            Enriched {result.enriched}
            {result.phoneRequested > 0 && `, ${result.phoneRequested} phone lookup(s) in progress (arriving shortly)`}
            {result.notFound > 0 && `, ${result.notFound} not found`}
            {result.skipped > 0 && `, ${result.skipped} already enriched (skipped — no credits spent)`}
            {result.errors > 0 && `, ${result.errors} error(s)`}
            {result.invalid?.length > 0 && ` · ${result.invalid.length} invalid URL(s) ignored`}
            {result.duplicates?.length > 0 && ` · ${result.duplicates.length} duplicate(s) collapsed`}
          </div>
        )}

        {/* Search */}
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts by name, company, or email…"
            style={{ width: '100%', maxWidth: 360, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        {/* Contact cards */}
        {filteredContacts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {contacts.length === 0 ? 'No enriched contacts yet.' : 'No contacts match your search.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filteredContacts.map(c => (
              <ContactCard key={c.id} c={c} copiedId={copiedId} onCopy={copyEmail} />
            ))}
          </div>
        )}
      </div>

      {/* Typed confirmation before spending credits */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm enrichment" width={460}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 12px' }}>You're about to enrich <strong style={{ color: 'var(--text)' }}>{uniqueCount}</strong> LinkedIn profile{uniqueCount === 1 ? '' : 's'}.</p>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
            <div>Email lookups: <strong>{uniqueCount}</strong> (≈{uniqueCount} credit{uniqueCount === 1 ? '' : 's'})</div>
            {wantPhone && (
              <div style={{ marginTop: 4 }}>
                Phone reveals: up to <strong>{Math.min(uniqueCount, phonesRemaining)}</strong> (8 credits each → up to <strong>{Math.min(uniqueCount, phonesRemaining) * 8}</strong> credits)
              </div>
            )}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontWeight: 700, color: 'var(--text)' }}>
              Worst-case total: ~{worstCaseCredits} credits
            </div>
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-3)' }}>
            Already-enriched contacts are skipped automatically (no credits). Credits are only charged when Apollo finds a match.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn onClick={() => setConfirmOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={runEnrichment}><Sparkles size={13} /> Confirm &amp; Enrich</Btn>
        </div>
      </Modal>
    </div>
  )
}

function ContactCard({ c, copiedId, onCopy }) {
  const initials = (c.name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const confColor = CONFIDENCE_COLOR[c.matchConfidence] || 'gray'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || 'Unnamed'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.title}{c.title && c.company ? ' @ ' : ''}{c.company}
          </div>
        </div>
        <Badge color={confColor}>{c.matchConfidence || 'n/a'}</Badge>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
        {c.email ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
            <Mail size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
            <button onClick={() => onCopy(c.id, c.email)} title="Copy email" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}>
              {copiedId === c.id ? <Check size={13} color="var(--green-text)" /> : <Copy size={13} />}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)' }}><Mail size={13} /> No email found</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
          <Phone size={13} style={{ flexShrink: 0 }} />
          {c.phone ? <span>{c.phone}</span>
            : c.phoneStatus === 'pending' ? <span style={{ color: 'var(--amber-text)' }}>Phone arriving…</span>
            : c.phoneStatus === 'none' ? <span style={{ color: 'var(--text-3)' }}>No mobile on file</span>
            : <span style={{ color: 'var(--text-3)' }}>Phone not requested</span>}
        </div>

        {c.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)' }}>
            <MapPin size={13} style={{ flexShrink: 0 }} /> {c.location}
          </div>
        )}
      </div>

      <a href={c.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginTop: 'auto' }}>
        <ExternalLink size={12} /> LinkedIn profile
      </a>
    </div>
  )
}
