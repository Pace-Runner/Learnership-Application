import { it } from 'vitest'
import * as App from './App'

it('debug exports', () => {
  // eslint-disable-next-line no-console
  console.log('App exports:', Object.keys(App))
})
