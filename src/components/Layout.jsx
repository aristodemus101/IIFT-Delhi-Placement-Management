// src/components/Layout.jsx
import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight,
  LogOut, ChevronRight, GraduationCap, Menu, X
} from 'lucide-react'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard',   exact: true },
  { to: '/roster',  icon: Users,           label: 'Roster'       },
  { to: '/placed',  icon: CheckSquare,     label: 'Placed'       },
  { to: '/remapper',icon: ArrowLeftRight,  label: 'Col. Remapper'},
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0',
        ...(mobileOpen ? {} : { '@media(max-width:768px)': { display: 'none' } })
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)',
              background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>PlacementOS</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>IIFT Batch 2027</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {NAV.map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              borderRadius: 'var(--radius-sm)', marginBottom: 2, textDecoration: 'none',
              fontSize: 14, fontWeight: isActive ? 500 : 400, transition: 'all 0.15s',
              background: isActive ? 'var(--surface2)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-2)',
            })}>
              <Icon size={16} />
              {label}
              {false && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 12px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
            <img src={user?.photoURL || ''} alt="" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
            <button onClick={handleLogout} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-3)', borderRadius: 4, display: 'flex' }} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}
