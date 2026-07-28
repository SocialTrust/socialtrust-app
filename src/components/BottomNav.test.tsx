// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'

afterEach(cleanup)

const labels = ['Home', 'Friends', 'Activity', 'Account']

describe('BottomNav', () => {
  it('renders exactly four labelled destinations', () => {
    render(<BottomNav activeTab="home" onNavigate={vi.fn()} />)
    const items = screen.getAllByRole('link')
    expect(items).toHaveLength(4)
    expect(items.map((item) => item.textContent)).toEqual(labels)
  })

  it('marks the selected tab with aria-current, not colour alone', () => {
    render(<BottomNav activeTab="activity" onNavigate={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Activity' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull()
  })

  it('navigates in-app on a plain click without a full page load', async () => {
    const onNavigate = vi.fn()
    render(<BottomNav activeTab="home" onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('link', { name: 'Friends' }))
    expect(onNavigate).toHaveBeenCalledWith('/friends')
  })

  it('keeps every item a real link so direct URLs still work', () => {
    render(<BottomNav activeTab="home" onNavigate={vi.fn()} />)
    expect(screen.getAllByRole('link').map((item) => item.getAttribute('href')))
      .toEqual(['/', '/friends', '/activity', '/me'])
  })

  it('goes inert while a modal sheet owns the screen', () => {
    const { container } = render(<BottomNav activeTab="home" onNavigate={vi.fn()} inactive />)
    const nav = container.querySelector('nav')!
    expect(nav.getAttribute('aria-hidden')).toBe('true')
    expect(nav.hasAttribute('inert')).toBe(true)
  })

  it('hides entirely for a full-screen experience', () => {
    const { container } = render(<BottomNav activeTab="home" onNavigate={vi.fn()} hidden />)
    expect(container.querySelector('nav')).toBeNull()
  })

  it('selects no tab when the route has none', () => {
    render(<BottomNav onNavigate={vi.fn()} />)
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull()
  })
})
