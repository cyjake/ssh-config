import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import SSHConfig from '../..'
import sinon from 'sinon'
import os from 'os'

const { DIRECTIVE } = SSHConfig

function readFile(fname: string) {
  const fpath = path.join(__dirname, '..', fname)
  return fs.readFileSync(fpath, 'utf-8').replace(/\r\n/g, '\n')
}

afterEach(() => {
  sinon.restore()
})

describe('SSHConfig', function() {
  it('.compute by Host', async function() {
    const config = SSHConfig.parse(readFile('fixture/config'))
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
      ProxyCommand: ['ssh', '-q', 'gateway', '-W', '%h:%p'],
      ServerAliveInterval: '80',
      User: 'nil',
      ForwardAgent: 'true'
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
        Host: ['foo', '*.bar', 'baz ham'],
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

  it('.find with nothing shall yield error', async function() {
    const config = SSHConfig.parse(readFile('fixture/config'))
    assert.throws(function() { config.find({}) })
  })

  it('.find shall return null if nothing were found', async function() {
    const config = SSHConfig.parse(readFile('fixture/config'))
    assert(config.find({ Host: 'not.exist' }) == null)
  })

  it('.find by Host', async function() {
    const config = SSHConfig.parse(readFile('fixture/config'))

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
        value: 'tahoe1.com'
      }, {
        type: DIRECTIVE,
        before: '  ',
        after: '\n\n',
        param: 'Compression',
        separator: ' ',
        value: 'yes'
      })
    })

    assert.deepEqual(config.find({ Host: '*' }), {
      type: DIRECTIVE,
      before: '',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: '*',
      config: new SSHConfig({
        type: DIRECTIVE,
        before: '  ',
        after: '\n\n',
        param: 'IdentityFile',
        separator: ' ',
        value: '~/.ssh/id_rsa'
      })
    })
  })

  it('.remove by Host', async function() {
    const config = SSHConfig.parse(readFile('fixture/config'))
    const length = config.length

    config.remove({ Host: 'no.such.host' })
    assert(config.length === length)

    config.remove({ Host: 'tahoe2' })
    assert(config.find({ Host: 'tahoe2' }) == null)
    assert(config.length === length - 1)

    assert.throws(function() { config.remove({}) })
  })

  it('.remove by function', async function() {
    const config = SSHConfig.parse(readFile('fixture/config'))
    const length = config.length

    config.remove((line) => line.type === DIRECTIVE && /Host/i.test(line.param) && line.value === 'tahoe2')
    assert(config.find({ Host: 'tahoe2' }) == null)
    assert(config.length === length - 1)

    assert.throws(function() { config.remove({}) })
  })

  it('.append lines', async function() {
    const config = SSHConfig.parse(`
      Host example
        HostName example.com
        User root
        Port 22
        IdentityFile /path/to/key
    `)

    config.append({
      Host: 'example2.com',
      User: 'pegg',
      IdentityFile: '~/.ssh/id_rsa'
    })

    const opts = config.compute('example2.com')
    assert(opts.User === 'pegg')
    assert.deepEqual(opts.IdentityFile, ['~/.ssh/id_rsa'])
    assert.deepEqual(config.find({ Host: 'example2.com' }), {
      type: DIRECTIVE,
      before: '      ',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'example2.com',
      config: new SSHConfig({
        type: DIRECTIVE,
        before: '        ',
        after: '\n',
        param: 'User',
        separator: ' ',
        value: 'pegg'
      },{
        type: DIRECTIVE,
        before: '        ',
        after: '\n',
        param: 'IdentityFile',
        separator: ' ',
        value: '~/.ssh/id_rsa'
      })
    })
  })

  it('.append with original identation recognized', function() {
    const config = SSHConfig.parse(`
      Host example1
        HostName example1.com
        User simon
        Port 1000
        IdentityFile /path/to/key
    `.replace(/  /g, '\t'))

    config.append({
      Host: 'example3.com',
      User: 'paul'
    })

    assert.deepEqual(config.find({ Host: 'example3.com' }), {
      type: DIRECTIVE,
      before: '\t\t\t',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'example3.com',
      config: new SSHConfig({
        type: DIRECTIVE,
        before: '\t\t\t\t',
        after: '\n',
        param: 'User',
        separator: ' ',
        value: 'paul'
      })
    })
  })

  it('.append with newline insersion', function() {
    const config = SSHConfig.parse(`
      Host test
        HostName google.com`)

    config.append({
      Host: 'test2',
      HostName: 'microsoft.com'
    })

    assert.equal(config.toString(), `
      Host test
        HostName google.com

      Host test2
        HostName microsoft.com
`)
  })

  it('.append to empty config', function() {
    const config = new SSHConfig()
    config.append({
      IdentityFile: '~/.ssh/id_rsa',
      Host: 'test2',
      HostName: 'example.com'
    })

    assert.equal(config.toString(), `IdentityFile ~/.ssh/id_rsa

Host test2
  HostName example.com
`)
  })

  it('.append to empty config with new section', function() {
    const config = new SSHConfig()
    config.append({
      Host: 'test',
      HostName: 'example.com',
    })

    assert.equal(config.toString(), `Host test
  HostName example.com
`)
  })

  it('.append to empty section config', function() {
    const config = SSHConfig.parse('Host test')
    config.append({
      HostName: 'example.com'
    })

    assert.equal(config.toString(), `Host test
  HostName example.com
`)
  })

  it('.compute with properties with multiple values', async function() {
    const config = SSHConfig.parse(`
      Host myHost
        HostName example.com
        LocalForward 1234 localhost:1234
        CertificateFile /foo/bar
        LocalForward 9876 localhost:9876
        CertificateFile /foo/bar2
        RemoteForward 8888 localhost:8888

      Host *
        CertificateFile /foo/bar3
    `)

    assert.deepEqual(config.compute('myHost'), {
      Host: 'myHost',
      HostName: 'example.com',
      LocalForward: ['1234 localhost:1234', '9876 localhost:9876'],
      RemoteForward: ['8888 localhost:8888'],
      CertificateFile: ['/foo/bar', '/foo/bar2', '/foo/bar3']
    })
  })

  it('.prepend lines', async function() {
    const config = SSHConfig.parse(`
      Host example
        HostName example.com
        User root
        Port 22
        IdentityFile /path/to/key
    `)

    config.prepend({
      Host: 'examplePrepend2.com',
      User: 'pegg2',
      IdentityFile: '~/.ssh/id_rsa'
    })

    const opts = config.compute('examplePrepend2.com')
    assert(opts.User === 'pegg2')
    assert.deepEqual(opts.IdentityFile, ['~/.ssh/id_rsa'])
    assert.deepEqual(config.find({ Host: 'examplePrepend2.com' }), {
      type: DIRECTIVE,
      before: '      ',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'examplePrepend2.com',
      config: new SSHConfig({
        type: DIRECTIVE,
        before: '        ',
        after: '\n',
        param: 'User',
        separator: ' ',
        value: 'pegg2'
      },{
        type: DIRECTIVE,
        before: '        ',
        after: '\n\n',
        param: 'IdentityFile',
        separator: ' ',
        value: '~/.ssh/id_rsa'
      })
    })
  })

  it('.prepend with original identation recognized', function() {
    const config = SSHConfig.parse(`
      Host example1
        HostName example1.com
        User simon
        Port 1000
        IdentityFile /path/to/key
    `.replace(/  /g, '\t'))

    config.prepend({
      Host: 'examplePrepend3.com',
      User: 'paul2'
    })

    assert.deepEqual(config.find({ Host: 'examplePrepend3.com' }), {
      type: DIRECTIVE,
      before: '\t\t\t',
      after: '\n',
      param: 'Host',
      separator: ' ',
      value: 'examplePrepend3.com',
      config: new SSHConfig({
        type: DIRECTIVE,
        before: '\t\t\t\t',
        after: '\n\n',
        param: 'User',
        separator: ' ',
        value: 'paul2'
      })
    })
  })

  it('.prepend with newline insertion', function() {
    const config = SSHConfig.parse(`
      Host test
        HostName google.com`)

    config.prepend({
      Host: 'testPrepend2',
      HostName: 'microsoft.com'
    })

    assert.equal(config.toString(), `      Host testPrepend2
        HostName microsoft.com


      Host test
        HostName google.com`)
  })

  it('.prepend to empty config', function() {
    const config = new SSHConfig()
    config.prepend({
      IdentityFile: '~/.ssh/id_rsa',
      Host: 'prependTest',
      HostName: 'example.com'
    })

    assert.equal(config.toString(), `IdentityFile ~/.ssh/id_rsa

Host prependTest
  HostName example.com

`)
  })

  it('.prepend to empty config with new section', function() {
    const config = new SSHConfig()
    config.prepend({
      Host: 'prependTest',
      HostName: 'example.com',
    })

    assert.equal(config.toString(), `Host prependTest
  HostName example.com

`)
  })

  it('.prepend to empty section config', function() {
    const config = SSHConfig.parse('Host test')
    config.prepend({
      HostName: 'example.com',
      User: 'brian'
    })

    assert.equal(config.toString(), `HostName example.com
User brian

Host test`)
  })

  it('.prepend to empty section and existing section config', function() {
    const config = SSHConfig.parse(`
Host test

Host test2
  HostName google.com`)

    config.prepend({
      HostName: 'example.com',
      User: 'brian'
    })

    assert.equal(config.toString(), `HostName example.com
User brian


Host test

Host test2
  HostName google.com`)
  })

  it('.prepend to with Include', function() {
    const config = SSHConfig.parse(`
      Include ~/.ssh/configs/*

      Host test2
        HostName google.com`)

    config.prepend({
      Host: 'example',
      HostName: 'microsoft.com',
    }, true)

    assert.equal(config.toString(), `
      Include ~/.ssh/configs/*

      Host example
        HostName microsoft.com

      Host test2
        HostName google.com`)
  })

  it('.prepend to with empty Include', function() {
    const config = SSHConfig.parse('Include ~/.ssh/configs/* ')

    config.prepend({
      Host: 'example',
      HostName: 'microsoft.com',
    }, true)

    assert.equal(config.toString(), `Include ~/.ssh/configs/*

Host example
  HostName microsoft.com
`)
  })
})
