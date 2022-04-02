'use strict'

const assert = require('assert').strict || require('assert')

const glob = require('../../src/glob')


describe('glob', function() {
  it('glob asterisk mark', function() {
    assert(glob('*', 'laputa'))
    assert(glob('lap*', 'laputa'))
    assert(glob('lap*ta', 'laputa'))
    assert(glob('laputa*', 'laputa'))

    assert(!glob('lap*', 'castle'))
  })

  it('glob question mark', function() {
    assert(glob('lap?ta', 'laputa'))
    assert(glob('laputa?', 'laputa'))

    assert(!glob('lap?ta', 'castle'))
  })

  it('glob pattern list', function() {
    assert(glob('laputa,castle', 'laputa'))
    assert(!glob('castle,in,the,sky', 'laputa'))
  })

  it('glob negated pattern list', function() {
    assert(glob('!*.dialup.example.com,*.example.com', 'www.example.com'))

    assert(!glob('!*.dialup.example.com,*.example.com', 'www.dialup.example.com'))
    assert(!glob('*.example.com,!*.dialup.example.com', 'www.dialup.example.com'))
  })

  it('glob the whole string', function() {
    assert(!glob('example', 'example1'))
  })

  it('glob chaining hosts', function() {
    assert(glob('*/*', 'host1/host2'))
    assert(glob('*+*', 'host1+host2'))
  })

  it('glob special chars', function() {
    assert(glob('(foo', '(foo'))
    assert(!glob('(foo)', 'foo'))
    assert(glob('[foo]', '[foo]'))
    assert(glob('{foo', '{foo'))
    assert(glob('^foo|ba\\r$', '^foo|ba\\r$'))
  })
})
