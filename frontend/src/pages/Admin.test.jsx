import { describe, it, expect } from 'vitest'

describe('Admin page - smoke tests', () => {
  it('exports Admin component', async () => {
    const Admin = (await import('./Admin')).default
    expect(Admin).toBeDefined()
  })

  it('Admin is a function component', async () => {
    const Admin = (await import('./Admin')).default
    expect(typeof Admin).toBe('function')
  })
})
