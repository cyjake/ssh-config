'use strict'

var expect = require('expect.js')

var glob = require('../lib/glob')


describe('glob', function() {
  it('glob asterisk mark', function() {
    expect(glob('*', 'laputa')).to.be(true)
    expect(glob('lap*', 'laputa')).to.be(true)
    expect(glob('lap*ta', 'laputa')).to.be(true)
    expect(glob('laputa*', 'laputa')).to.be(true)

    expect(glob('lap*', 'castle')).to.be(false)
  })

  it('glob question mark', function() {
    expect(glob('lap?ta', 'laputa')).to.be(true)
    expect(glob('laputa?', 'laputa')).to.be(true)

    expect(glob('lap?ta', 'castle')).to.be(false)
  })

  it('glob pattern list', function() {
    expect(glob('laputa,castle', 'laputa')).to.be(true)
    expect(glob('castle,in,the,sky', 'laputa')).to.be(false)
  })

  it('glob negated pattern list', function() {
    expect(glob('!laputa,castle', 'laputa')).to.be(false)
    expect(glob('!castle,in,the,sky', 'laputa')).to.be(true)
  })

  it('glob the whole string', function() {
    expect(glob('example', 'example1')).to.be(false)
  })
})
