import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminConnorLaptop from './Admin-ConnorLaptop'

describe('Admin ConnorLaptop page', () => {
  it('renders the moderation workspace content', () => {
    render(<AdminConnorLaptop onLogout={vi.fn()} />)

    expect(screen.getByText('Admin Workspace')).toBeTruthy()
    expect(screen.getByText('Platform Moderation Console')).toBeTruthy()
    expect(screen.getByText('Moderation Queue')).toBeTruthy()
    expect(screen.getByText('Quick Actions')).toBeTruthy()
  })
})