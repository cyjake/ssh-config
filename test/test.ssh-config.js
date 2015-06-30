'use strict'

var expect = require('expect.js')
var fs = require('fs')
var path = require('path')
var sshConfig = require('..')


describe('ssh-config', function() {
  var fixture = fs.readFileSync(path.join(__dirname, 'fixture/config'), 'utf-8')
  var config = sshConfig.parse(fixture)

  it('.parse ssh config text into object', function() {
    expect(config.ControlMaster).to.equal('auto')
    expect(config.length).to.equal(4)

    expect(config[0]).to.eql({
      Host: 'tahoe1',
      HostName: 'tahoe1.com',
      Compression: 'yes'
    })
  })

  it('.query ssh config by host', function() {
    var opts = config.query('tahoe2')

    expect(opts.User).to.equal('nil')
    expect(opts.IdentityFile).to.equal('~/.ssh/id_rsa')

    // the first obtained parameter value will be used. So there's no way to
    // override parameter values.
    expect(opts.ServerAliveInterval).to.eql(80)

    opts = config.query('tahoe1')
    expect(opts.User).to.equal('nil')
    expect(opts.ForwardAgent).to.equal('true')
    expect(opts.Compression).to.equal('yes')
  })

  it('.stringify the parsed object back to string', function() {
    expect(fixture).to.contain(sshConfig.stringify(config))
  })
})
