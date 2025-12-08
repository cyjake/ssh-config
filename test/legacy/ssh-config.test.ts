import { strict as assert } from 'node:assert'
import { SSHConfig, type Line } from '../../dist/ssh-config.js'
import { heredoc, readFixture } from '../helpers.cjs'

const { DIRECTIVE } = SSHConfig

describe('SSHConfig', function() {
  it('.find with nothing shall yield error', async function() {
    const config = SSHConfig.parse(await readFixture('config'))
    assert.throws(function() { config.find({}) })
  })

  it('.find shall return null if nothing were found', async function() {
    const config = SSHConfig.parse(await readFixture('config'))
    assert(config.find({ Host: 'not.exist' }) == null)
  })

  it('.find by Host', async function() {
    const config = SSHConfig.parse(await readFixture('config'))

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
    const config = SSHConfig.parse(await readFixture('config'))
    const length = config.length

    config.remove({ Host: 'no.such.host' })
    assert(config.length === length)

    config.remove({ Host: 'tahoe2' })
    assert(config.find({ Host: 'tahoe2' }) == null)
    assert(config.length === length - 1)

    assert.throws(function() { config.remove({}) })
  })

  it('.remove by function', async function() {
    const config = SSHConfig.parse(await readFixture('config'))
    const length = config.length

    config.remove((line: Line) => line.type === DIRECTIVE && /Host/i.test(line.param) && line.value === 'tahoe2')
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

    assert.equal(config.toString(), heredoc(`
      IdentityFile ~/.ssh/id_rsa

      Host test2
        HostName example.com
    `))
  })

  it('.append to empty config with new section', function() {
    const config = new SSHConfig()
    config.append({
      Host: 'test',
      HostName: 'example.com',
    })

    assert.equal(config.toString(), heredoc(`
      Host test
        HostName example.com
    `))
  })

  it('.append to empty section config', function() {
    const config = SSHConfig.parse('Host test')
    config.append({
      HostName: 'example.com'
    })

    assert.equal(config.toString(), heredoc(`
      Host test
        HostName example.com
    `))
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

    assert.equal(config.toString().trim(), heredoc(`
      IdentityFile ~/.ssh/id_rsa

      Host prependTest
        HostName example.com

    `).trim())
  })

  it('.prepend to empty config with new section', function() {
    const config = new SSHConfig()
    config.prepend({
      Host: 'prependTest',
      HostName: 'example.com',
    })

    assert.equal(config.toString(), heredoc(`
      Host prependTest
        HostName example.com

    `))
  })

  it('.prepend to empty section config', function() {
    const config = SSHConfig.parse('Host test\n')
    config.prepend({
      HostName: 'example.com',
      User: 'brian'
    })

    assert.equal(config.toString(), heredoc(`
      HostName example.com
      User brian

      Host test
    `))
  })

  it('.prepend to empty section and existing section config', function() {
    const config = SSHConfig.parse(heredoc(`
      Host test

      Host test2
        HostName google.com
    `))

    config.prepend({
      HostName: 'example.com',
      User: 'brian'
    })

    assert.equal(config.toString(), heredoc(`
      HostName example.com
      User brian

      Host test

      Host test2
        HostName google.com
     `))
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

    assert.equal(config.toString(), heredoc(`
      Include ~/.ssh/configs/*

      Host example
        HostName microsoft.com
    `))
  })

  it('.prepend directive with multiple values', function() {
    const config = new SSHConfig()

    config.prepend({
      Host: ['example.com', 'example.me'],
      HostName: 'example-inc.dev',
    })

    assert.equal(config.toString(), heredoc(`
      Host example.com example.me
        HostName example-inc.dev

    `))
  })
})
