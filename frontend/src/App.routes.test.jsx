import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute, ProviderWorkspaceRoute, ProviderProfileRoute } from './App'

describe('Route guard components', () => {
  it('ProtectedRoute shows loading shell when loading and not signed in', () => {
    render(
      <MemoryRouter initialEntries={['/']}> 
        <ProtectedRoute role={null} allowedRole="Applicant" signedIn={false} isLoading={true}>
          <div>secret</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Checking your session/i)).toBeTruthy()
  })

  it('ProtectedRoute redirects unauthenticated users to home', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute role={null} allowedRole="Applicant" signedIn={false} isLoading={false}>
                <div>secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('home').length).toBeGreaterThan(0)
  })

  it('ProtectedRoute redirects wrong role users to home', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute role={'Provider'} allowedRole="Admin" signedIn={true} isLoading={false}>
                <div>secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('home').length).toBeGreaterThan(0)
  })

  it('ProtectedRoute allows correct role to render children', () => {
    render(
      <MemoryRouter>
        <ProtectedRoute role={'Applicant'} allowedRole="Applicant" signedIn={true} isLoading={false}>
          <div>secret</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByText('secret')).toBeTruthy()
  })

  it('ProviderWorkspaceRoute redirects provider without correct landing route', () => {
    render(
      <MemoryRouter initialEntries={['/provider']}>
        <Routes>
          <Route path="/provider/profile" element={<div>profile</div>} />
          <Route
            path="/provider"
            element={
              <ProviderWorkspaceRoute role={'Provider'} signedIn={true} isLoading={false} providerLandingRoute={'/provider/profile'}>
                <div>workspace</div>
              </ProviderWorkspaceRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    // providerLandingRoute not '/provider' should redirect to profile
    expect(screen.getByText('profile')).toBeTruthy()
  })

  it('ProviderProfileRoute blocks non-provider users', () => {
    render(
      <MemoryRouter initialEntries={['/provider/profile']}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route
            path="/provider/profile"
            element={
              <ProviderProfileRoute role={'Applicant'} signedIn={true} isLoading={false}>
                <div>providerprofile</div>
              </ProviderProfileRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('home').length).toBeGreaterThan(0)
  })
})
