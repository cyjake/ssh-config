'use strict'

var expect = require('expect.js')
var fs = require('fs')
var path = require('path')
var sshConfig = require('..')


function readFile(fpath) {
  return fs.readFileSync(path.join(__dirname, fpath), 'utf-8')
    .replace(/\r\n/g, '\n')
}

describe('ssh-config', function() {
  var fixture = readFile('fixture/config')
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

  it('.stringify the parsed object back to string', function() {
    expect(fixture).to.contain(sshConfig.stringify(config))
  })
})


describe('ssh-config helper methods', function() {
  var config = sshConfig.parse(readFile('fixture/config'))

  it('.query ssh config by host', function() {
    var opts = config.query('tahoe2')

    expect(opts.User).to.equal('nil')
    expect(opts.IdentityFile).to.equal('~/.ssh/id_rsa')

    // the first obtained parameter value will be used. So there's no way to
    // override parameter values.
    expect(opts.ServerAliveInterval).to.eql(80)

    // the query result is flat on purpose.
    expect(config.query('tahoe1')).to.eql({
      Compression: 'yes',
      ControlMaster: 'auto',
      ControlPath: '~/.ssh/master-%r@%h:%p',
      Host: 'tahoe1',
      HostName: 'tahoe1.com',
      IdentityFile: '~/.ssh/id_rsa',
      ProxyCommand: 'ssh -q gateway -W %h:%p',
      ServerAliveInterval: '80',
      User: 'nil',
      ForwardAgent: 'true'
    })
  })

  it('.query the whole host string', function() {
    var config2 = sshConfig.parse(readFile('fixture/config2'))

    expect(config2.query('example1')).to.eql({
      Host: 'example1',
      HostName: 'example1.com',
      User: 'simon',
      Port: '1000',
      IdentityFile: '/path/to/key'
    })
  })

  it('.find section', function() {
    expect(config.find({ Host: 'tahoe1' })).to.eql({
      Host: 'tahoe1',
      HostName: 'tahoe1.com',
      Compression: 'yes'
    })

    expect(config.find({ Host: '*' })).to.eql({
      Host: '*',
      IdentityFile: '~/.ssh/id_rsa'
    })
  })

  it('check duplications before .append', function() {
    expect(function() {
      config.append({
        Host: 'tahoe1',
        HostName: 'tahoe1.com'
      })
    })
      .to.throwException(/duplicate/i)
  })

  it('.append section', function() {
    config.append({
      Host: 'tahoe3',
      HostName: 'tahoe3.com',
      User: 'keanu'
    })

    expect(config.find({ Host: 'tahoe3' })).to.eql({
      Host: 'tahoe3',
      HostName: 'tahoe3.com',
      User: 'keanu'
    })
  })

  it('.remove section', function() {
    config.remove({ Host: 'tahoe3' })
    expect(config.find({ Host: 'tahoe3' })).to.be(null)
  })
})
