'use strict'

// strict mode is not available until v9.9.0
const assert = require('assert').strict || require('assert')
const fs = require('fs')
const heredoc = require('heredoc').strip
const path = require('path')
const SSHConfig = require('..')

const { parse, COMMENT, DIRECTIVE } = SSHConfig

function readFile(fpath) {
  return fs.readFileSync(path.join(__dirname, fpath), 'utf-8')
    .replace(/\r\n/g, '\n')
}

describe('parse', function() {
  it('.parse simple config', function() {
    const config = parse(readFile('fixture/config'))

    assert.equal(config[0].param, 'ControlMaster')
    assert.equal(config[0].value, 'auto')
    assert.equal(config.length, 7)

    assert.deepEqual(config.find({ Host: 'tahoe1' }), {
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'tahoe1',
      config: new SSHConfig({
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
      })
    })
  })

  it('.parse config with parameters and values separated by =', function() {
    const config = parse(heredoc(function() {/*
      Host=tahoe4
        HostName=tahoe4.com
        User=keanu
    */}))

    assert.deepEqual(config[0], {
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: '=',
      value: 'tahoe4',
      config: new SSHConfig({
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
      })
    })
  })

  it('.parse comments', function() {
    const config = parse(heredoc(function() {/*
      # I'd like to travel to lake tahoe.
      Host tahoe1
        HostName tahoe1.com

      # or whatever place it is.
      # I just need another vocation.
      Host *
        IdentityFile ~/.ssh/ids/whosyourdaddy
    */}))

    assert.equal(config[0].type, COMMENT)
    assert.equal(config[0].content, "# I'd like to travel to lake tahoe.")

    // The comments goes with sections. So the structure is not the way it seems.
    assert.equal(config[1].config[1].type, COMMENT)
    assert.equal(config[1].config[1].content, '# or whatever place it is.')
  })

  it('.parse multiple IdentityFile', function() {
    const config = parse(heredoc(function() {/*
      # Fallback Identify Files
      IdentityFile ~/.ssh/ids/%h/%r/id_rsa
      IdentityFile ~/.ssh/ids/%h/id_rsa
      IdentityFile ~/.ssh/id_rsa
    */}))

    assert.equal(config[1].param, 'IdentityFile')
    assert.equal(config[1].value, '~/.ssh/ids/%h/%r/id_rsa')

    assert.equal(config[2].param, 'IdentityFile')
    assert.equal(config[2].value, '~/.ssh/ids/%h/id_rsa')

    assert.equal(config[3].param, 'IdentityFile')
    assert.equal(config[3].value, '~/.ssh/id_rsa')
  })

  it('.parse IdentityFile with spaces', function() {
    const config = parse(heredoc(function() {/*
      IdentityFile C:\Users\John Doe\.ssh\id_rsa
      IdentityFile "C:\Users\John Doe\.ssh\id_rsa"
    */}))

    assert.equal(config[0].param, 'IdentityFile')
    assert.equal(config[0].value, 'C:\\Users\\John Doe\\.ssh\\id_rsa')

    assert.equal(config[1].param, 'IdentityFile')
    assert.equal(config[1].value, 'C:\\Users\\John Doe\\.ssh\\id_rsa')
  })

  it('.parse Host with quoted hosts that contain spaces', function() {
    const config = parse('Host "foo bar"')
    assert.equal(config[0].param, 'Host')
    assert.equal(config[0].value, 'foo bar')
  })

  it('.parse Host with multiple patterns', function() {
    const config = parse('Host foo "!*.bar" "baz ham" "foo\\"bar"')

    assert.equal(config[0].param, 'Host')
    assert.deepEqual(config[0].value, [
      'foo',
      '!*.bar',
      'baz ham',
      'foo"bar'
    ])
  })
})
