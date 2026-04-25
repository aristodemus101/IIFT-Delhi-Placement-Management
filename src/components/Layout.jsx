import React, { useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useTheme } from '../lib/ThemeContext'
import { useBatch } from '../lib/BatchContext'
import { useStudents } from '../lib/useStudents'
import { batchLabel, normalizeBatch } from '../lib/batch'
import { Badge, Btn, Modal } from './UI'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight,
  LogOut, GraduationCap, ShieldCheck, ClipboardCheck, User, Sun, Moon
} from 'lucide-react'

export default function Layout() {
  const { user, role, logout } = useAuth()
  const { pendingCount } = usePendingChanges()
  const { theme, toggleTheme } = useTheme()
  const { selectedBatch, setSelectedBatch, options } = useBatch()
  const { students } = useStudents()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [nextBatch, setNextBatch] = useState(null)
  const [workspaceActions, setWorkspaceActions] = useState(null)

  const batchCounts = students.reduce((acc, s) => {
    const b = normalizeBatch(s._batch)
    if (b === 'summer') acc.summer += 1
    else acc.final += 1
    return acc
  }, { summer: 0, final: 0 })

  const batchStats = students.reduce((acc, s) => {
    const b = normalizeBatch(s._batch)
    if (b === 'summer') {
      if (s._placed) acc.summer.placed += 1
      else acc.summer.ytp += 1
    } else {
      if (s._placed) acc.final.placed += 1
      else acc.final.ytp += 1
    }
    return acc
  }, { summer: { ytp: 0, placed: 0 }, final: { ytp: 0, placed: 0 } })

  const selectedOption = useMemo(() => options.find(o => o.value === selectedBatch) || options[0], [options, selectedBatch])
  const nextOption = useMemo(() => options.find(o => o.value === nextBatch), [options, nextBatch])

  const requestBatchSwitch = (value) => {
    if (value === selectedBatch) return
    setNextBatch(value)
    setBatchConfirmOpen(true)
  }

  const confirmBatchSwitch = () => {
    if (!nextBatch) return
    setSelectedBatch(nextBatch)
    setBatchConfirmOpen(false)
    setNextBatch(null)
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const NAV = [
    { to: '/',          icon: LayoutDashboard, label: 'Dashboard',    exact: true, adminOnly: false },
    { to: '/roster',    icon: Users,           label: 'Roster',       exact: false, adminOnly: false },
    { to: '/placed',    icon: CheckSquare,     label: 'Placed',       exact: false, adminOnly: false },
    { to: '/remapper',  icon: ArrowLeftRight,  label: 'Col. Remapper',exact: false, adminOnly: false },
    { to: '/approvals', icon: ClipboardCheck,  label: 'Approvals',    exact: false, adminOnly: true, badge: pendingCount },
    { to: '/admin',     icon: ShieldCheck,     label: 'Team Access',  exact: false, adminOnly: true },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 236,
        flexShrink: 0,
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>PlacementOS</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>IIFT Delhi</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px' }}>
          <div style={{ marginBottom: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>
              Active Batch
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {options.map(opt => {
                const active = selectedBatch === opt.value
                const isSummer = opt.value === 'summer'
                return (
                  <button
                    key={opt.value}
                    onClick={() => requestBatchSwitch(opt.value)}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      border: `1px solid ${active ? (isSummer ? 'var(--amber)' : 'var(--accent)') : 'var(--border)'}`,
                      background: active ? (isSummer ? 'color-mix(in srgb, var(--batch-summer-bg) 78%, var(--surface))' : 'color-mix(in srgb, var(--batch-final-bg) 78%, var(--surface))') : 'var(--surface)',
                      color: active ? (isSummer ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
                      boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent)' : 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '7px 6px',
                      cursor: 'pointer',
                    }}
                    title={`Switch to ${opt.label}`}
                  >
                    {opt.short}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 9 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: 'var(--text-2)' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', paddingBottom: 3 }}>Batch</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-3)', paddingBottom: 3 }}>YTP</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-3)', paddingBottom: 3 }}>Placed</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-3)', paddingBottom: 3 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700, color: 'var(--batch-summer-text)', paddingTop: 2 }}>Summer</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{batchStats.summer.ytp}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--green-text)', paddingTop: 2 }}>{batchStats.summer.placed}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{batchCounts.summer}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700, color: 'var(--batch-final-text)', paddingTop: 2 }}>Final</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{batchStats.final.ytp}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--green-text)', paddingTop: 2 }}>{batchStats.final.placed}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{batchCounts.final}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {NAV.filter(n => !n.adminOnly || isAdmin).map(({ to, icon: Icon, label, exact, badge }) => (
            <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              borderRadius: 'var(--radius-sm)', marginBottom: 2, textDecoration: 'none',
              fontSize: 14, fontWeight: isActive ? 600 : 500,
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              color: isActive ? 'var(--accent-dark)' : 'var(--text-2)',
              border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'transparent'}`,
            })}>
              <Icon size={16} />
              {label}
              {badge > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--accent-dark)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div style={{ padding: '12px 12px 0', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: '100%',
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text-2)',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName}</div>
              <div style={{ fontSize: 10, color: isAdmin ? 'var(--accent)' : 'var(--text-3)', fontWeight: isAdmin ? 600 : 400 }}>
                {isAdmin ? '⬡ Admin' : 'Viewer'}
              </div>
            </div>
            <button onClick={handleLogout} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-3)', borderRadius: 4, display: 'flex' }} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'transparent', borderTop: '2px solid var(--workspace-border)' }}>
        <div style={{
          padding: '6px 12px',
          margin: '8px 14px 0',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--workspace-bg)',
          border: '1px solid var(--workspace-border)',
          color: 'var(--workspace-text)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={selectedBatch === 'summer' ? 'amber' : 'blue'}>{batchLabel(selectedBatch)}</Badge>
            Workspace
          </div>
          {workspaceActions ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {workspaceActions}
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Outlet context={{ setWorkspaceActions }} />
        </div>
      </main>

      <Modal open={batchConfirmOpen} onClose={() => setBatchConfirmOpen(false)} title="Switch active batch?" width={520}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
          You are currently in <strong>{batchLabel(selectedBatch)}</strong>.
          {nextOption ? <> Switch to <strong>{nextOption.label}</strong>?</> : null}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={() => setBatchConfirmOpen(false)}>Stay Here</Btn>
          <Btn variant="primary" onClick={confirmBatchSwitch}>Yes, Switch Batch</Btn>
        </div>
      </Modal>
    </div>
  )
}
