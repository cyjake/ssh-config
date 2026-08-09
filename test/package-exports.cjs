const assert = require('node:assert').strict

const commonjs = require('ssh-config')

assert.equal(typeof commonjs.parse, 'function')
assert.equal(typeof commonjs.stringify, 'function')
assert.equal(typeof commonjs.default, 'function')

const parsed = commonjs.parse('Host example\n  User root\n')
assert.equal(parsed.compute('example').User, 'root')

import('ssh-config').then((esm) => {
  assert.equal(typeof esm.parse, 'function')
  assert.equal(typeof esm.stringify, 'function')
  assert.equal(typeof esm.default, 'function')

  const parsed = esm.parse('Host example\n  User root\n')
  assert.equal(parsed.compute('example').User, 'root')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
