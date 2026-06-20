import React from 'react'
import { PageHeader, Badge, Btn } from '../components/UI'
import { ExternalLink, Tag, Calendar, GraduationCap } from 'lucide-react'

const VERSION     = import.meta.env.VITE_APP_VERSION   || 'dev'
const BUILD_DATE  = import.meta.env.VITE_APP_BUILD_DATE || null
const REPO        = 'aristodemus101/IIFT-Delhi-Placement-Management'
const RELEASE_URL = `https://github.com/${REPO}/releases/tag/${VERSION}`

export default function AboutPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="About" />

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>

        {/* App identity */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GraduationCap size={28} color="var(--accent)" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>PlacementOS</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>IIFT Delhi</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
            Internal placement management platform for the IIFT Delhi Placement Committee.
            Designed to streamline candidate tracking, placement proposals, approvals,
            TPO outreach, and analytics across Summer Internship and Final Placement cycles.
          </p>
        </div>

        {/* Version info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Release</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Tag size={13} color="var(--green-text)" />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{VERSION}</span>
              {VERSION !== 'dev' && <Badge color="green">Latest</Badge>}
              {VERSION === 'dev' && <Badge color="gray">Local build</Badge>}
            </div>
            {BUILD_DATE && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                <Calendar size={13} />
                {BUILD_DATE}
              </div>
            )}
          </div>
          {VERSION !== 'dev' && (
            <a
              href={RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', width: 'fit-content' }}
            >
              <Btn variant="ghost" size="sm">
                <ExternalLink size={13} />
                View release on GitHub
              </Btn>
            </a>
          )}
        </div>

        {/* Credits */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Credits</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
            Built and maintained by the <strong style={{ color: 'var(--text)' }}>IIFT Delhi Placement Committee</strong>.
          </p>
        </div>

      </div>
    </div>
  )
}
