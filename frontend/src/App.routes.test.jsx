import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute, ProviderWorkspaceRoute, ProviderProfileRoute } from './App.jsx'

// Quick smoke tests for route guard branches in App.jsx
describe('App route guards', () => {
  test('shows loading shell when auth is loading and not signed in', () => {
    render(
      <MemoryRouter initialEntries={["/x"]}>
        <ProtectedRoute role={null} allowedRole="Applicant" signedIn={false} isLoading={true}>
          <div>secret</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Checking your session/i)).toBeInTheDocument()
  })

  test('redirects unauthenticated users to home', () => {
    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute role={null} allowedRole="Applicant" signedIn={false} isLoading={false}>
                <div>secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  test('provider workspace route renders for signed-in providers', () => {
    render(
      <MemoryRouter initialEntries={["/provider/work"]}>
        <Routes>
          <Route
            path="/provider/work"
            element={
              <ProviderWorkspaceRoute role={'Provider'} signedIn={true} isLoading={false}>
                <div>workspace</div>
              </ProviderWorkspaceRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('workspace')).toBeInTheDocument()
  })
})
