import { describe, it, expect } from 'vitest'

describe('Dashboard page - smoke tests', () => {
  it('exports Dashboard component', async () => {
    const Dashboard = (await import('./Dashboard')).default
    expect(Dashboard).toBeDefined()
  })

  it('Dashboard is a function component', async () => {
    const Dashboard = (await import('./Dashboard')).default
    expect(typeof Dashboard).toBe('function')
  })
})
