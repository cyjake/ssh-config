import { strict as assert } from 'assert'
import SSHConfig from '../..'
import os from 'os'
import sinon from 'sinon'
import { readFixture } from '../helpers'

afterEach(() => {
  sinon.restore()
})

describe('compute', function() {

  it('.compute by Host', async function() {
    const config = SSHConfig.parse(await readFixture('config'))
    const opts = config.compute('tahoe2')

    assert(opts.User === 'nil')
    assert.deepEqual(opts.IdentityFile, ['~/.ssh/id_rsa'])

    // the first obtained parameter value will be used. So there's no way to
    // override parameter values.
    assert.equal(opts.ServerAliveInterval, '80')

    // the computed result is flat on purpose.
    assert.deepEqual(config.compute('tahoe1'), {
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
      ForwardAgent: 'true',
    })
  })

  it('.compute by Host with globbing', async function() {
    const config = SSHConfig.parse(`
      Host example*
        HostName example.com
        User simon
    `)

    assert.deepEqual(config.compute('example1'), {
      Host: 'example*',
      HostName: 'example.com',
      User: 'simon'
    })
  })

  it('.compute by Host with multiple patterns', async function() {
    const config = SSHConfig.parse(`
      Host foo "*.bar" "baz ham"
        HostName example.com
        User robb
    `)

    for (const host of ['foo', 'foo.bar', 'baz ham']) {
      assert.deepEqual(config.compute(host), {
        Host: [
          'foo',
          '*.bar',
          'baz ham',
        ],
        HostName: 'example.com',
        User: 'robb'
      })
    }
  })

  /**
   * - https://github.com/cyjake/ssh-config/issues/19
   * - https://github.com/microsoft/vscode-remote-release/issues/612
   * - https://en.wikibooks.org/wiki/OpenSSH/Cookbook/Proxies_and_Jump_Hosts#Recursively_Chaining_an_Arbitrary_Number_of_Hosts
   */
  it('.compute by Host with chaining hosts', async function() {
    const config = SSHConfig.parse(`
      Host *+*
        ProxyCommand ssh -W $(echo %h | sed 's/^.*+//;s/^\\([^:]*$\\)/\\1:22/') $(echo %h | sed 's/+[^+]*$//;s/\\([^+%%]*\\)%%\\([^+]*\\)$/\\2 -l \\1/;s/:\\([^:+]*\\)$/ -p \\1/')
    `)

    for (const host of ['host1+host2', 'host1:2022+host2:2224']) {
      const result = config.compute(host)
      assert(result)
      assert(result.hasOwnProperty('ProxyCommand'))
    }
  })

  it('.compute By Host with canonical domains', async () => {
    const config = SSHConfig.parse(`
      Host www.cyj.me
        ServerAliveInterval 60
        ServerAliveCountMax 2

      Host www
        User matthew
        CanonicalizeHostName yes
        CanonicalDomains cyj.notfound cyj.me
    `)

    const result = config.compute('www')
    assert.ok(result)
    assert.equal(result.ServerAliveCountMax, '2')
  })

  it('.compute By Host with canonical domains', async () => {
    const config = SSHConfig.parse(`
      Host www.example.net
        ServerAliveInterval 60
        ServerAliveCountMax 2

      Host *
        User matthew
        CanonicalizeHostName yes
        CanonicalDomains example.net example.com
    `)

    const result = config.compute('www')
    assert.ok(result)
    assert.equal(result.ServerAliveCountMax, '2')
  })

  it('.compute By Host with multiple values', async () => {
    const config = SSHConfig.parse(`
      Host example.com example.me
        HostName example-inc.com
    `)

    const result = config.compute('example.me')
    assert.ok(result)
    assert.equal(result.HostName, 'example-inc.com')
  })

  it('.compute by Match host', async function() {
    const config = SSHConfig.parse(`
      Match host tahoe1
        HostName tahoe.com

      Match host tahoe2
        HostName tahoe.org
    `)
    const result = config.compute('tahoe1')
    assert.ok(result)
    assert.equal(result.HostName, 'tahoe.com')
    assert.equal(result.Match, undefined)
  })

  it('.compute by Match exec', async function() {
    const config = SSHConfig.parse(`
      Match exec "return 1" host tahoe1
        HostName tahoe.com

      Match exec "return 0" host tahoe1
        HostName tahoe.local
    `)
    const result = config.compute('tahoe1')
    assert.ok(result)
    assert.equal(result.HostName, 'tahoe.local')
  })

  it('.compute by Match host and user', async function() {
    const config = SSHConfig.parse(`
      Match host tahoe1 user foo
        HostName tahoe.com

      Match host tahoe1 user bar
        # comment
        HostName tahoe.org

      IdentityFIle /path/to/key
    `)
    const result = config.compute({ Host: 'tahoe1', User: 'bar' })
    assert.ok(result)
    assert.equal(result.HostName, 'tahoe.org')
    assert.equal(result.Match, undefined)
  })

  it('.compute by explicit user', async function() {
    const config = SSHConfig.parse(`
      User wrong
    `)
    const result = config.compute({ Host: 'tahoe1', User: 'bar' })
    assert.ok(result)
    assert.equal(result.User, 'bar')
  })

  it('.compute by Match host uses HostName', async function() {
    const config = SSHConfig.parse(`
      Host tahoe
        HostName tahoe.com

      # Host does not use HostName until the second pass
      Host *.com
        ProxyJump wrong.proxy.com

      Match host *.com
        ProxyJump proxy.com
    `)
    const result = config.compute({ Host: 'tahoe' })
    assert.ok(result)
    assert.equal(result.HostName, 'tahoe.com')
    assert.equal(result.ProxyJump, 'proxy.com')
  })

  it('.compute with Match final does second pass with HostName', async function() {
    const config = SSHConfig.parse(`
      Match final

      Host tahoe
        HostName tahoe.com

      Host *.com
        ProxyJump proxy.com
    `)
    const result = config.compute({ Host: 'tahoe' })
    assert.ok(result)
    assert.equal(result.HostName, 'tahoe.com')
    assert.equal(result.ProxyJump, 'proxy.com')
  })

  it('.compute with os.userInfo() throwing SystemError should have fallback', async () => {
    const mock = sinon.mock(os)
    mock.expects('userInfo').throws(new Error('user has no username or homedir'))
    const config = SSHConfig.parse('')
    const result = config.compute({ Host: 'tahoe' })
    assert.ok(result)
  })

  it('.compute should fallback to process.env.USERNAME on Windows', async () => {
    const mock = sinon.mock(os)
    mock.expects('userInfo').throws(new Error('user has no username or homedir'))
    for (const key of ['USER', 'USERNAME']) {
      if (process.env[key] != null) sinon.stub(process.env, key).value(undefined)
    }
    sinon.define(process.env, 'USERNAME', 'test')
    const config = SSHConfig.parse('')
    const result = config.compute({ Host: 'tahoe' })
    assert.ok(result)
  })

  it('.compute should default username to empty string if failed to get from env', async () => {
    const mock = sinon.mock(os)
    mock.expects('userInfo').throws(new Error('user has no username or homedir'))
    for (const key of ['USER', 'USERNAME']) {
      if (process.env[key] != null) sinon.stub(process.env, key).value(undefined)
    }
    const config = SSHConfig.parse('')
    const result = config.compute({ Host: 'tahoe' })
    assert.ok(result)
  })

  it('.compute should preserve separators in multi-value directives', async () => {
    const config = SSHConfig.parse(`
      Host YYYY
        HostName YYYY
        IdentityFile ~/.ssh/id_rsa
        StrictHostKeyChecking no
        UserKnownHostsFile /dev/null
        ProxyCommand ssh -i ~/.ssh/id_rsa -W %h:%p -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null XXX@ZZZ
        User XXX
    `)

    const result = config.compute({ Host: 'YYYY' })
    assert.equal(result.ProxyCommand, 'ssh -i ~/.ssh/id_rsa -W %h:%p -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null XXX@ZZZ')
  })

  it('.compute should preserve quotes in multi-value directives', async () => {
    const config = SSHConfig.parse(`
      Host YYYY
        HostName YYYY
        IdentityFile ~/.ssh/id_rsa
        StrictHostKeyChecking no
        UserKnownHostsFile /dev/null
        ProxyCommand "/foo/bar - baz/proxylauncher.sh" "/some/param with space"
        User XXX
    `)
    const result = config.compute({ Host: 'YYYY' })
    assert.equal(result.ProxyCommand, '"/foo/bar - baz/proxylauncher.sh" "/some/param with space"')
  })

})
