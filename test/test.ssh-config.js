'use strict'

var expect = require('expect.js')
var fs = require('fs')
var path = require('path')
var heredoc = require('heredoc').strip

var sshConfig = require('..')


function readFile(fpath) {
  return fs.readFileSync(path.join(__dirname, fpath), 'utf-8')
    .replace(/\r\n/g, '\n')
}

describe('.parse', function() {
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

  it('.parse parameters with their names and values separated by =', function() {
    var config2 = sshConfig.parse(heredoc(function() {/*
      Host=tahoe4
        HostName=tahoe4.com
        User=keanu
    */}))

    expect(config2).to.eql({
      '0': {
        Host: 'tahoe4',
        HostName: 'tahoe4.com',
        User: 'keanu'
      }
    })
  })
})


describe('.stringify', function() {
  var fixture = readFile('fixture/config')
  var config = sshConfig.parse(fixture)

  it('.stringify the parsed object back to string', function() {
    expect(fixture).to.contain(sshConfig.stringify(config))
  })

  it('.stringify sections without leading blank line', function() {
    var config = {
      '0': {
        Host: 'tahoe4',
        HostName: 'tahoe4.com',
        User: 'keanu'
      }
    }
    Object.defineProperty(config, 'length', {
      value: 1,
      enumerable: false
    })

    expect(sshConfig.stringify(config)).to.equal(heredoc(function() {/*
      Host tahoe4
        HostName tahoe4.com
        User keanu
    */}).trim())
  })
})


describe('.query', function() {
  var config = sshConfig.parse(readFile('fixture/config'))

  it('.query ssh config by host', function() {
    var opts = config.query('tahoe2')

    expect(opts.User).to.equal('nil')
    expect(opts.IdentityFile).to.eql(['~/.ssh/id_rsa', '~/.ssh/ids/%h/id_rsa', '~/.ssh/ids/%h/%r/id_rsa'].reverse())

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
      IdentityFile: ['~/.ssh/id_rsa', '~/.ssh/ids/%h/id_rsa', '~/.ssh/ids/%h/%r/id_rsa'].reverse(),
      ProxyCommand: 'ssh -q gateway -W %h:%p',
      ServerAliveInterval: '80',
      User: 'nil',
      ForwardAgent: 'true'
    })
  })

  it('.query ssh config that uses Match', function() {
    var config2 = sshConfig.parse(heredoc(function() {/*
      Match host tahoe4
        HostName tahoe4.com
        User keanu
    */}))

    // not implemented yet.
    expect(config2.query('tahoe4')).to.eql({})
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
})


describe('.find', function() {
  var config = sshConfig.parse(readFile('fixture/config'))

  it('cannot find nothing', function() {
    expect(function() { config.find() }).to.throwException()
    expect(function() { config.find({}) }).to.throwException()
  })

  it('.find Host section', function() {
    expect(config.find({ Host: 'tahoe1' })).to.eql({
      Host: 'tahoe1',
      HostName: 'tahoe1.com',
      Compression: 'yes'
    })

    expect(config.find({ Host: '*' })).to.eql({
      Host: '*',
      IdentityFile: ['~/.ssh/id_rsa', '~/.ssh/ids/%h/id_rsa', '~/.ssh/ids/%h/%r/id_rsa'].reverse(),
    })
  })

  it('.find Match section', function() {
    // Match related features are not ready yet.
    expect(config.find({ Match: 'host tahoe1' })).to.be(null)
  })
})


describe('.append', function() {
  var config = sshConfig.parse(readFile('fixture/config'))

  it('cannot .append invalid section', function() {
    expect(function() { config.append() }).to.throwException()
    expect(function() { config.append({}) }).to.throwException()
    expect(function() {
      config.append({
        HostName: 'tahoe5.com',
        User: 'keanu'
      })
    })
      .to.throwException()
  })

  it('.append Host section', function() {
    // check duplications before .append
    expect(function() {
      config.append({
        Host: 'tahoe1',
        HostName: 'tahoe1.com'
      })
    })
      .to.throwException(/duplicate/i)

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

  it('.append Match section', function() {
    config.append({
      Match: 'host tahoe4',
      HostName: 'tahoe4.com'
    })

    // Match parameter is not fully implemented yet.
    expect(config.find({ Match: 'host tahoe4'})).to.eql({
      Match: 'host tahoe4',
      HostName: 'tahoe4.com'
    })

    expect(function() {
      config.append({ Match: 'host tahoe4'})
    })
      .to.throwException(/duplicate/i)
  })
})


describe('.remove', function() {
  var config = sshConfig.parse(readFile('fixture/config'))

  it('.remove section', function() {
    var length = config.length
    config.remove({ Host: 'no.such.host' })
    expect(config.length).to.equal(length)

    config.remove({ Host: 'tahoe2' })
    expect(config.find({ Host: 'tahoe2' })).to.be(null)
    expect(config.length).to.equal(length - 1)

    expect(function() { config.remove() }).to.throwException()
    expect(function() { config.remove({}) }).to.throwException()
  })
})
