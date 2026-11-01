// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock the virtual PWA module so the component is testable outside a real SW.
// needRefresh state is controllable per test via a module-level holder.
const state = { needRefresh: true, updateSpy: vi.fn(() => Promise.resolve()), setNeedRefresh: vi.fn() }
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [state.needRefresh, state.setNeedRefresh],
    updateServiceWorker: state.updateSpy,
  }),
}))

import PwaUpdatePrompt from '../PwaUpdatePrompt.jsx'

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.needRefresh = true
    state.updateSpy = vi.fn(() => Promise.resolve())
    state.setNeedRefresh = vi.fn()
  })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('renders the banner when a refresh is needed', () => {
    render(<PwaUpdatePrompt />)
    expect(screen.getByText('A new version is available.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('renders nothing when no refresh is needed', () => {
    state.needRefresh = false
    render(<PwaUpdatePrompt />)
    expect(screen.queryByText('A new version is available.')).toBeNull()
  })

  it('Reload calls updateServiceWorker(true)', () => {
    render(<PwaUpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(state.updateSpy).toHaveBeenCalledWith(true)
  })

  it('Reload guarantees a page reload via the fallback timer even if the SW handshake never resolves', () => {
    const reloadSpy = vi.fn()
    // jsdom's location.reload isn't implemented; replace it.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    })
    // updateServiceWorker returns a never-resolving promise (simulates the flaky case)
    state.updateSpy = vi.fn(() => new Promise(() => {}))
    render(<PwaUpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: /Reload/ }))
    expect(reloadSpy).not.toHaveBeenCalled() // not yet — timer pending
    vi.advanceTimersByTime(1500)
    expect(reloadSpy).toHaveBeenCalled() // fallback fired
  })

  it('Reload button shows a reloading state after click', () => {
    state.updateSpy = vi.fn(() => new Promise(() => {}))
    render(<PwaUpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(screen.getByRole('button', { name: 'Reloading…' })).toBeTruthy()
  })

  it('dismiss (×) clears needRefresh', () => {
    render(<PwaUpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(state.setNeedRefresh).toHaveBeenCalledWith(false)
  })
})
