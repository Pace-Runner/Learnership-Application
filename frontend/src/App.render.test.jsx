import { describe, it, expect } from 'vitest'


describe('App - smoke tests', () => {
  it('exports App component', async () => {
    const { default: App } = await import('./App')
    expect(App).toBeDefined()
  })

  it('App is a function component', async () => {
    const { default: App } = await import('./App')
    expect(typeof App).toBe('function')
  })
})
