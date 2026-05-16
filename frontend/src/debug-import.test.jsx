import { it } from 'vitest'
import * as App from './App'

it('debug exports', () => {
  console.log('App exports:', Object.keys(App))
})
