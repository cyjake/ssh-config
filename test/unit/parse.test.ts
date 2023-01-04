import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import SSHConfig from '../..'

const { parse, COMMENT, DIRECTIVE } = SSHConfig

function readFile(fname) {
  const fpath = path.join(__dirname, '..', fname)
  return fs.readFileSync(fpath, 'utf-8').replace(/\r\n/g, '\n')
}

describe('parse', function() {
  it('.parse simple config', async function() {
    const config = parse(readFile('fixture/config'))

    assert.equal(config[0].type, DIRECTIVE)
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
    const config = parse(`
      Host=tahoe4
        HostName=tahoe4.com
        User=keanu
    `)

    assert.deepEqual(config[0], {
      type: DIRECTIVE,
      before: '\n      ',
      after: '\n',
      param: 'Host',
      separator: '=',
      value: 'tahoe4',
      config: new SSHConfig({
        type: DIRECTIVE,
        before: '        ',
        after: '\n',
        param: 'HostName',
        separator: '=',
        value: 'tahoe4.com'
      },{
        type: DIRECTIVE,
        before: '        ',
        after: '\n    ',
        param: 'User',
        separator: '=',
        value: 'keanu'
      })
    })
  })

  it('.parse comments', function() {
    const config = parse(`
      # I'd like to travel to lake tahoe.
      Host tahoe1
        HostName tahoe1.com

      # or whatever place it is.
      # I just need another vocation.
      Host *
        IdentityFile ~/.ssh/ids/whosyourdaddy
    `)

    assert.equal(config[0].type, COMMENT)
    assert.equal(config[0].content, "# I'd like to travel to lake tahoe.")

    // The comments goes with sections. So the structure is not the way it seems.
    assert.equal(config[1].type, DIRECTIVE)
    assert.ok('config' in config[1])
    assert.equal(config[1].config[1].type, COMMENT)
    assert.equal(config[1].config[1].content, '# or whatever place it is.')
  })

  it('.parse multiple IdentityFile', function() {
    const config = parse(`
      # Fallback Identify Files
      IdentityFile ~/.ssh/ids/%h/%r/id_rsa
      IdentityFile ~/.ssh/ids/%h/id_rsa
      IdentityFile ~/.ssh/id_rsa
    `)

    assert.equal(config[1].type, DIRECTIVE)
    assert.equal(config[1].param, 'IdentityFile')
    assert.equal(config[1].value, '~/.ssh/ids/%h/%r/id_rsa')

    assert.equal(config[2].type, DIRECTIVE)
    assert.equal(config[2].param, 'IdentityFile')
    assert.equal(config[2].value, '~/.ssh/ids/%h/id_rsa')

    assert.equal(config[3].type, DIRECTIVE)
    assert.equal(config[3].param, 'IdentityFile')
    assert.equal(config[3].value, '~/.ssh/id_rsa')
  })

  it('.parse IdentityFile with spaces', function() {
    const config = parse(`
      IdentityFile C:\\Users\\John Doe\\.ssh\\id_rsa
      IdentityFile "C:\\Users\\John Doe\\.ssh\\id_rsa"
    `)

    assert.equal(config[0].type, DIRECTIVE)
    assert.equal(config[0].param, 'IdentityFile')
    assert.equal(config[0].value, 'C:\\Users\\John Doe\\.ssh\\id_rsa')

    assert.equal(config[1].type, DIRECTIVE)
    assert.equal(config[1].param, 'IdentityFile')
    assert.equal(config[1].value, 'C:\\Users\\John Doe\\.ssh\\id_rsa')
  })

  it('.parse quoted values with escaped double quotes', function() {
    const config = parse('IdentityFile "C:\\Users\\John\\" Doe\\.ssh\\id_rsa"')
    assert.equal(config[0].type, DIRECTIVE)
    assert.equal(config[0].param, 'IdentityFile')
    assert.equal(config[0].value, 'C:\\Users\\John" Doe\\.ssh\\id_rsa')
  })

  it('.parse unquoted values that contain double quotes', function() {
    const config = parse('ProxyCommand ssh -W "%h:%p" firewall.example.org')
    assert.equal(config[0].type, DIRECTIVE)
    assert.equal(config[0].param, 'ProxyCommand')
    assert.deepEqual(config[0].value, ['ssh', '-W', '%h:%p', 'firewall.example.org'])
  })

  // https://github.com/microsoft/vscode-remote-release/issues/5562
  it('.parse ProxyCommand with multiple args, some quoted', function() {
    const config = parse(`
      Host foo
        ProxyCommand "C:\\foo bar\\baz.exe" "arg" "arg" "arg"
    `)

    assert.equal(config[0].type, DIRECTIVE)
    assert.ok('config' in config[0])
    assert.equal(config[0].config[0].type, DIRECTIVE)
    assert.equal(config[0].config[0].param, 'ProxyCommand')
    assert.deepEqual(config[0].config[0].value, ['C:\\foo bar\\baz.exe', 'arg', 'arg', 'arg'])
  })

  it('.parse open ended values', function() {
    assert.throws(() => parse('IdentityFile "C:\\'), /Unexpected line break/)
    assert.throws(() => parse('Host "foo bar'), /Unexpected line break/)
    assert.throws(() => parse('Host "foo bar\\"'), /Unexpected line break/)
  })

  it('.parse Host with quoted hosts that contain spaces', function() {
    const config = parse('Host "foo bar"')
    assert.equal(config[0].type, DIRECTIVE)
    assert.equal(config[0].param, 'Host')
    assert.equal(config[0].value, 'foo bar')
  })

  it('.parse Host with multiple patterns', function() {
    const config = parse('Host foo "!*.bar"  "baz ham"   "foo\\"bar"')

    assert.equal(config[0].type, DIRECTIVE)
    assert.equal(config[0].param, 'Host')
    assert.deepEqual(config[0].value, [
      'foo',
      '!*.bar',
      'baz ham',
      'foo"bar'
    ])
  })

  it('.parse Host with multiple random patterns', function() {
    const config = parse('Host me local    wi*ldcard?  thisVM "two words"')

    assert.equal(config[0].type, DIRECTIVE)
    assert.deepEqual(config[0].value, [
      'me',
      'local',
      'wi*ldcard?',
      'thisVM',
      'two words'
    ])
  })

  // #32
  it('.parse Host with trailing spaces', function() {
    const config = parse(`
      Host penlv
        HostName penlv-devbox
        User penlv
    `.replace('penlv\n', 'penlv \n'))

    assert.equal(config[0].type, DIRECTIVE)
    assert.deepEqual(config[0].value, 'penlv')
  })

  it('.parse parameter and value separated with tab', function() {
    /**
     * Host foo
     *   HostName example.com
     */
    const config = parse('Host\tfoo\n\tHostName\texample.com')

    assert.deepEqual(config[0], {
      type: 1,
      param: 'Host',
      separator: '\t',
      value: 'foo',
      before: '',
      after: '\n',
      config: new SSHConfig({
        type: 1,
        param: 'HostName',
        separator: '\t',
        value: 'example.com',
        before: '\t',
        after: ''
      })
    })
  })

  it('.parse config with extra blank lines', function() {
    const config = parse(`
      IdentityFile ~/.ssh/id_rsa

      Host ness
        HostName lochness.com
    `)
    assert.deepEqual(config.find({ Host: 'ness' }), {
      type: 1,
      param: 'Host',
      separator: ' ',
      value: 'ness',
      before: '      ',
      after: '\n',
      config: new SSHConfig({
        type: 1,
        param: 'HostName',
        separator: ' ',
        value: 'lochness.com',
        before: '        ',
        after: '\n    '
      })
    })
  })

  it('.parse match criteria', function() {
    const config = parse(`
      Match exec "/Users/me/onsubnet --not 192.168.1." host docker
        ProxyJump exthost
        Hostname 192.168.1.10
        User user1
        Port 22

      Host docker
        Hostname docker
    `)
    const match = config.find(line => line.type === DIRECTIVE && line.param === 'Match')
    assert.ok(match)
    assert.ok('conditions' in match)
    assert.deepEqual(match.conditions, {
      exec: '/Users/me/onsubnet --not 192.168.1.',
      host: 'docker',
    })
  })
})
