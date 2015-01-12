'use strict';

var expect = require('expect.js')
var fs = require('fs')
var path = require('path')
var sshConfig = require('..')


describe('ssh-config', function() {
  var fixture = fs.readFileSync(path.join(__dirname, 'fixture/config'), 'utf-8')
  var config = sshConfig.parse(fixture)

  it('.parse', function() {
    expect(config.ControlMaster).to.equal('auto')
    expect(config.length).to.equal(2)

    expect(config[0]).to.eql({
      Host: 'tahoe1',
      HostName: 'tahoe1.linode',
      User: 'nil',
      ProxyCommand: 'ssh -q gateway -W %h:%p',
      ForwardAgent: 'true'
    })
  })

  it('.stringify', function() {
    expect(fixture).to.contain(sshConfig.stringify(config))
  })
})
