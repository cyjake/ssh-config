'use strict'

const expect = require('expect.js')
const fs = require('fs')
const path = require('path')
const heredoc = require('heredoc').strip

const SSHConfig = require('..')

const { DIRECTIVE, COMMENT } = SSHConfig

function readFile(fpath) {
  return fs.readFileSync(path.join(__dirname, fpath), 'utf-8')
    .replace(/\r\n/g, '\n')
}


describe('SSHConfig', function() {
  it('.parse simple config', function() {
    let config = SSHConfig.parse(readFile('fixture/config'))

    expect(config[0].param).to.equal('ControlMaster')
    expect(config[0].value).to.equal('auto')
    expect(config.length).to.equal(7)

    expect(config.find({ Host: 'tahoe1' })).to.eql({
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'tahoe1',
      config: [{
        type: DIRECTIVE,
        before: '  ',
        after: '\n',
        param: 'HostName',
        separator: ' ',
        value: 'tahoe1.com',
      }, {
        type: DIRECTIVE,
        before: '  ',
        after: '\n\n',
        param: 'Compression',
        separator: ' ',
        value: 'yes'
      }]
    })
  })


  it('.parse config with parameters and values separated by =', function() {
    let config2 = SSHConfig.parse(heredoc(function() {/*
      Host=tahoe4
        HostName=tahoe4.com
        User=keanu
    */}))

    expect(config2[0]).to.eql({
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: '=',
      value: 'tahoe4',
      config: [{
        type: DIRECTIVE,
        before: '  ',
        after: '\n',
        param: 'HostName',
        separator: '=',
        value: 'tahoe4.com'
      },{
        type: DIRECTIVE,
        before: '  ',
        after: '\n',
        param: 'User',
        separator: '=',
        value: 'keanu'
      }]
    })
  })


  it('.parse comments', function() {
    let config = SSHConfig.parse(heredoc(function() {/*
      # I'd like to travel to lake tahoe.
      Host tahoe1
        HostName tahoe1.com

      # or whatever place it is.
      # I just need another vocation.
      Host *
        IdentityFile ~/.ssh/ids/whosyourdaddy
    */}))

    expect(config[0].type).to.equal(COMMENT)
    expect(config[0].content).to.equal("# I'd like to travel to lake tahoe.")

    // The comments goes with sections. So the structure is not the way it seems.
    expect(config[1].config[1].type).to.equal(COMMENT)
    expect(config[1].config[1].content).to.equal('# or whatever place it is.')
  })


  it('.parse multiple IdentityFile', function() {
    let config = SSHConfig.parse(heredoc(function() {/*
      # Fallback Identify Files
      IdentityFile ~/.ssh/ids/%h/%r/id_rsa
      IdentityFile ~/.ssh/ids/%h/id_rsa
      IdentityFile ~/.ssh/id_rsa
    */}))

    expect(config[1].param).to.equal('IdentityFile')
    expect(config[1].value).to.equal('~/.ssh/ids/%h/%r/id_rsa')

    expect(config[2].param).to.equal('IdentityFile')
    expect(config[2].value).to.equal('~/.ssh/ids/%h/id_rsa')

    expect(config[3].param).to.equal('IdentityFile')
    expect(config[3].value).to.equal('~/.ssh/id_rsa')
  })


  it('.parse IdentityFile with spaces', function() {
    let config = SSHConfig.parse(heredoc(function() {/*
      IdentityFile C:\Users\fname lname\.ssh\id_rsa
      IdentityFile "C:\Users\fname lname\.ssh\id_rsa"
    */}))

    expect(config[0].param).to.equal('IdentityFile')
    expect(config[0].value).to.equal('C:\\Users\\fname lname\\.ssh\\id_rsa')

    expect(config[1].param).to.equal('IdentityFile')
    expect(config[1].value).to.equal('C:\\Users\\fname lname\\.ssh\\id_rsa')
  })


  it('.parse Host with double quotes', function() {
    let config = SSHConfig.parse(heredoc(function() {/*
      Host foo "!*.bar"
    */}))

    expect(config[0].param).to.equal('Host')
    expect(config[0].value).to.equal('foo "!*.bar"')
  })


  it('.stringify the parsed object back to string', function() {
    let fixture = readFile('fixture/config')
    let config = SSHConfig.parse(fixture)
    expect(fixture).to.contain(SSHConfig.stringify(config))
  })


  it('.stringify config with white spaces and comments retained', function() {
    let config = SSHConfig.parse(heredoc(function() {/*
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    */}))

    expect(SSHConfig.stringify(config)).to.equal(heredoc(function() {/*
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    */}))
  })


  it('.stringify IdentityFile entries with double quotes', function() {
    let config = SSHConfig.parse(heredoc(function() {/*
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    */}))

    expect(SSHConfig.stringify(config)).to.equal(heredoc(function() {/*
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    */}))
  })


  it('.compute by Host', function() {
    let config = SSHConfig.parse(readFile('fixture/config'))
    let opts = config.compute('tahoe2')

    expect(opts.User).to.equal('nil')
    expect(opts.IdentityFile).to.eql(['~/.ssh/id_rsa'])

    // the first obtained parameter value will be used. So there's no way to
    // override parameter values.
    expect(opts.ServerAliveInterval).to.eql(80)

    // the computed result is flat on purpose.
    expect(config.compute('tahoe1')).to.eql({
      Compression: 'yes',
      ControlMaster: 'auto',
      ControlPath: '~/.ssh/master-%r@%h:%p',
      Host: 'tahoe1',
      HostName: 'tahoe1.com',
      IdentityFile: [
        '~/.ssh/id_rsa'
      ],
      ProxyCommand: 'ssh -q gateway -W %h:%p',
      ServerAliveInterval: '80',
      User: 'nil',
      ForwardAgent: 'true'
    })
  })


  it('.compute by Host with globbing', function() {
    let config2 = SSHConfig.parse(readFile('fixture/config2'))

    expect(config2.compute('example1')).to.eql({
      Host: 'example1',
      HostName: 'example1.com',
      User: 'simon',
      Port: '1000',
      IdentityFile: [
        '/path/to/key'
      ]
    })
  })


  it('.find with nothing shall yield error', function() {
    let config = SSHConfig.parse(readFile('fixture/config'))
    expect(function() { config.find() }).to.throwException()
    expect(function() { config.find({}) }).to.throwException()
  })


  it('.find shall return null if nothing were found', function() {
    let config = SSHConfig.parse(readFile('fixture/config'))
    expect(config.find({ Host: 'not.exist' })).to.be(null)
  })


  it('.find by Host', function() {
    let config = SSHConfig.parse(readFile('fixture/config'))

    expect(config.find({ Host: 'tahoe1' })).to.eql({
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'tahoe1',
      config: [{
        type: DIRECTIVE,
        before: '  ',
        after: '\n',
        param: 'HostName',
        separator: ' ',
        value: 'tahoe1.com'
      }, {
        type: DIRECTIVE,
        before: '  ',
        after: '\n\n',
        param: 'Compression',
        separator: ' ',
        value: 'yes'
      }]
    })

    expect(config.find({ Host: '*' })).to.eql({
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: '*',
      config: [{
        type: DIRECTIVE,
        before: '  ',
        after: '\n\n',
        param: 'IdentityFile',
        separator: ' ',
        value: '~/.ssh/id_rsa'
      }]
    })
  })


  it('.remove by Host', function() {
    let config = SSHConfig.parse(readFile('fixture/config'))
    let length = config.length

    config.remove({ Host: 'no.such.host' })
    expect(config.length).to.equal(length)

    config.remove({ Host: 'tahoe2' })
    expect(config.find({ Host: 'tahoe2' })).to.be(null)
    expect(config.length).to.equal(length - 1)

    expect(function() { config.remove() }).to.throwException()
    expect(function() { config.remove({}) }).to.throwException()
  })

  it('.append lines', function() {
    const config = SSHConfig.parse(readFile('fixture/config2'))

    config.append({
      Host: 'example2.com',
      User: 'pegg',
      IdentityFile: '~/.ssh/id_rsa'
    })

    const opts = config.compute('example2.com')
    expect(opts.User).to.eql('pegg')
    expect(opts.IdentityFile).to.eql(['~/.ssh/id_rsa'])
    expect(config.find({ Host: 'example2.com' })).to.eql({
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'example2.com',
      config: [{
        type: DIRECTIVE,
        before: '  ',
        after: '\n',
        param: 'User',
        separator: ' ',
        value: 'pegg'
      },{
        type: DIRECTIVE,
        before: '  ',
        after: '\n',
        param: 'IdentityFile',
        separator: ' ',
        value: '~/.ssh/id_rsa'
      }]
    })
  })

  it('.append with original identation recognized', function() {
    const config = SSHConfig.parse(readFile('fixture/config3'))

    config.append({
      Host: 'example3.com',
      User: 'paul'
    })

    expect(config.find({ Host: 'example3.com' })).to.eql({
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'example3.com',
      config: [{
        type: DIRECTIVE,
        before: '\t',
        after: '\n',
        param: 'User',
        separator: ' ',
        value: 'paul'
      }]
    })
  })

  it('.append with newline insersion', function() {
    const config = SSHConfig.parse(heredoc(function() {/*
      Host test
        HostName google.com*/}))

    config.append({
      Host: 'test2',
      HostName: 'microsoft.com'
    })

    expect('' + config).to.eql(heredoc(function() {/*
      Host test
        HostName google.com
      Host test2
        HostName microsoft.com
    */}))
  })
})
