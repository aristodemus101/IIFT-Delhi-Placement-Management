// src/components/UI.jsx
import React from 'react'
import { ShieldOff, X } from 'lucide-react'

export function PageHeader({ title, subtitle, actions, context }) {
  return (
    <div className="page-header" style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      padding: '14px 24px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    }}>
      {context && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
          letterSpacing: '0.01em', marginBottom: 6,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          {context}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1.15,
            color: 'var(--text)', margin: 0,
          }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.5 }}>{subtitle}</p>}
        </div>
        {actions && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 8, flexWrap: 'wrap', marginLeft: 'auto',
          }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export function Btn({ children, variant = 'default', size = 'md', onClick, disabled, style = {}, ...props }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 'var(--radius-sm)', fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontFamily: 'var(--font-sans)',
    letterSpacing: '-0.01em',
    transition: 'background var(--speed-fast) var(--easing-out), border-color var(--speed-fast) var(--easing-out), box-shadow var(--speed-fast) var(--easing-out), transform var(--speed-fast) var(--easing-out), opacity var(--speed-fast) var(--easing-out)',
    ...(size === 'sm' ? { padding: '5px 11px', fontSize: 12 } : { padding: '8px 14px', fontSize: 13 })
  }
  const variants = {
    default: {
      background: 'var(--surface)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
    },
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: '0 1px 3px rgba(37,99,235,0.3), 0 4px 12px rgba(37,99,235,0.15)',
    },
    success: {
      background: 'var(--green-bg)',
      color: 'var(--green-text)',
      border: '1px solid var(--green-border)',
    },
    danger: {
      background: 'var(--red-bg)',
      color: 'var(--red-text)',
      border: '1px solid var(--red-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-2)',
      border: '1px solid transparent',
    },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray:   { bg: 'var(--surface2)', text: 'var(--text-2)', border: 'var(--border)' },
    green:  { bg: 'var(--green-bg)', text: 'var(--green-text)', border: 'var(--green-border)' },
    amber:  { bg: 'var(--amber-bg)', text: 'var(--amber-text)', border: 'var(--amber-border)' },
    red:    { bg: 'var(--red-bg)',   text: 'var(--red-text)',   border: 'var(--red-border)' },
    blue:   { bg: 'var(--accent-bg)',text: 'var(--accent-text)', border: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
    purple: { bg: 'var(--purple-bg)',text: 'var(--purple-text)', border: 'color-mix(in srgb, var(--purple) 30%, transparent)' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.01em',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{children}</span>
  )
}

export function StatCard({ label, value, sub, color }) {
  const dotColor = color || 'var(--accent)'
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px 14px',
      flex: 1, minWidth: 0,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{
          fontSize: 10, color: 'var(--text-3)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>{label}</div>
      </div>
      <div style={{
        fontSize: 30, fontWeight: 'var(--weight-xbold)',
        letterSpacing: '-0.03em', lineHeight: 1,
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        marginBottom: sub ? 6 : 0,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--text-3)',
          lineHeight: 1.45, marginTop: 2,
        }}>{sub}</div>
      )}
    </div>
  )
}

export function Input({ style = {}, ...props }) {
  return (
    <input
      style={{
        height: 36, padding: '0 12px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)', fontSize: 13,
        outline: 'none',
        transition: 'border-color var(--speed-fast) var(--easing-out), box-shadow var(--speed-fast) var(--easing-out)',
        ...style
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--accent)'
        e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)'
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--border)'
        e.target.style.boxShadow = 'none'
      }}
      {...props}
    />
  )
}

export function Select({ style = {}, children, ...props }) {
  const arrow = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%236B7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`
  return (
    <select
      style={{
        height: 36, padding: '0 36px 0 12px',
        borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
        width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'block',
        appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
        backgroundImage: arrow,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 11px center',
        backgroundSize: '12px 8px',
        lineHeight: 1.2,
        transition: 'border-color var(--speed-fast) var(--easing-out), box-shadow var(--speed-fast) var(--easing-out), background-color var(--speed-fast) var(--easing-out)',
        ...style
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--accent)'
        e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)'
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--border)'
        e.target.style.boxShadow = 'none'
      }}
      onMouseEnter={e => {
        if (document.activeElement !== e.target) e.target.style.backgroundColor = 'color-mix(in srgb, var(--surface) 90%, var(--surface2))'
      }}
      onMouseLeave={e => {
        if (document.activeElement !== e.target) e.target.style.backgroundColor = 'var(--surface)'
      }}
      {...props}
    >{children}</select>
  )
}

export function Table({ headers, rows, emptyMessage = 'No data', onRowContextMenu }) {
  return (
    <div className="table-wrap">
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} onClick={h.onClick} style={{
                textAlign: 'left', padding: '10px 14px',
                fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)',
                background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                cursor: h.onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                userSelect: 'none',
                transition: 'color var(--speed-fast) var(--easing-out)',
              }}
              onMouseEnter={h.onClick ? e => { e.currentTarget.style.color = 'var(--text-2)' } : undefined}
              onMouseLeave={h.onClick ? e => { e.currentTarget.style.color = 'var(--text-3)' } : undefined}
              >
                {h.label}{h.sorted ? (h.sorted === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ textAlign: 'center', padding: '48px 40px', color: 'var(--text-3)', fontSize: 13 }}>
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--border)', transition: 'background var(--speed-fast) var(--easing-out)' }}
              onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, i) : undefined}
              onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--surface2) 60%, transparent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 520, closeOnBackdropClick = true }) {
  if (!open) return null
  return (
    <div
      className="modal-backdrop"
      onClick={closeOnBackdropClick ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        className="modal-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          width, maxWidth: '100%', maxHeight: '88vh',
          overflowX: 'hidden', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0,
          background: 'color-mix(in srgb, var(--surface) 96%, transparent)',
          backdropFilter: 'blur(12px)',
          zIndex: 1,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--border)', background: 'var(--surface2)',
              cursor: 'pointer', color: 'var(--text-3)',
              padding: 0, width: 28, height: 28,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

export function CategoryBadge({ category }) {
  const map = {
    'General': 'blue', 'OBC - NCL': 'amber', 'OBC': 'amber',
    'SC': 'purple', 'ST': 'red', 'EWS': 'green'
  }
  return <Badge color={map[category] || 'gray'}>{category || '—'}</Badge>
}

export function UnauthorizedMessage({ message = 'You do not have permission to view this page.' }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, color: 'var(--text-3)', padding: 40, textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--red-bg)', border: '1px solid var(--red-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShieldOff size={22} color="var(--red-text)" />
      </div>
      <p style={{ fontSize: 14, maxWidth: 360, color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</p>
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.65s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// TabBar — unified tab switcher used across Dashboard, Placed, Analytics
// tabs: [{ key, label, color? }]  color overrides the accent for the active underline (e.g. 'var(--amber)')
export function TabBar({ tabs, active, onChange, style = {} }) {
  return (
    <div className="tab-bar" style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      paddingLeft: 20,
      ...style,
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        const lineColor = tab.color || 'var(--accent)'
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              borderBottom: isActive ? `2px solid ${lineColor}` : '2px solid transparent',
              color: isActive ? lineColor : 'var(--text-2)',
              marginBottom: -1,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.01em',
              transition: 'color var(--speed-fast) var(--easing-out), border-color var(--speed-fast) var(--easing-out)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-2)' }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// SectionCard — collapsible detail card used on Dashboard
export function SectionCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px 12px',
      display: 'flex', flexDirection: 'column', gap: 0,
      ...style,
    }}>
      {children}
    </div>
  )
}
