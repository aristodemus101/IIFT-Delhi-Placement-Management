// src/components/UI.jsx
import React from 'react'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      padding: '24px 28px 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

export function Btn({ children, variant = 'default', size = 'md', onClick, disabled, style = {}, ...props }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
    borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
    ...(size === 'sm' ? { padding: '5px 10px', fontSize: 12 } : { padding: '7px 14px', fontSize: 13 })
  }
  const variants = {
    default:  { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
    primary:  { background: 'var(--text)',    color: 'var(--surface)' },
    success:  { background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' },
    danger:   { background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' },
    ghost:    { background: 'transparent', color: 'var(--text-2)', border: '1px solid transparent' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...props}>
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
    blue:   { bg: 'var(--accent-bg)',text: 'var(--accent-text)', border: '#BFDBFE' },
    purple: { bg: 'var(--purple-bg)',text: 'var(--purple-text)', border: '#DDD6FE' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`
    }}>{children}</span>
  )
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '16px 20px', flex: 1, minWidth: 120
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function Input({ style = {}, ...props }) {
  return (
    <input style={{
      height: 34, padding: '0 10px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)', background: 'var(--surface)',
      color: 'var(--text)', fontSize: 13, outline: 'none',
      transition: 'border-color 0.15s',
      ...style
    }}
    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
    {...props} />
  )
}

export function Select({ style = {}, children, ...props }) {
  return (
    <select style={{
      height: 34, padding: '0 10px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)', background: 'var(--surface)',
      color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
      ...style
    }} {...props}>{children}</select>
  )
}

export function Table({ headers, rows, emptyMessage = 'No data' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} onClick={h.onClick} style={{
                textAlign: 'left', padding: '9px 14px',
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap', cursor: h.onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                userSelect: 'none'
              }}>
                {h.label}{h.sorted ? (h.sorted === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>{emptyMessage}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'var(--surface2)') }}
              onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = '') }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 14px', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 16
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        width, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto',
        boxShadow: 'var(--shadow)', border: '1px solid var(--border)'
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, fontSize: 18 }}>×</button>
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

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--border)', borderTopColor: 'var(--text)',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
