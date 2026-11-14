
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { type Directive, type Section, SSHConfig, parse, stringify } from '../../src/ssh-config.ts'
import { readFixture } from '../helpers.ts'

describe('stringify', function() {
  it('.stringify the parsed object back to string', async function() {
    const fixture = await readFixture('config')
    const config = parse(fixture)
    assert.equal(fixture, stringify(config))
  })

  it('.stringify empty config retained', function() {
    assert.equal(stringify(parse('')), '')
    assert.equal(stringify(parse('\n')), '\n')
    assert.equal(stringify(parse('  \n  ')), '  \n  ')
  })

  it('.stringify config with white spaces and comments retained', function() {
    const config = parse(`
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    `)

    assert.equal(stringify(config), `
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    `)
  })

  it('.stringify IdentityFile entries with double quotes', function() {
    const config = parse(`
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    `)

    assert.equal(stringify(config), `
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    `)
  })

  it('.stringify IndentityAgent entries with double quotes', function() {
    const config = parse(`
      Host example
        HostName example.com
        IdentityAgent "~/Library/Group Containers"
    `)

    assert.equal(stringify(config), `
      Host example
        HostName example.com
        IdentityAgent "~/Library/Group Containers"
    `)
  })

  it('.stringify IndentityAgent entries with double quotes', function() {
    const config = new SSHConfig()
    config.append({
      Host: 'example',
      IdentityAgent: '~/Library/Group Containers',
    })

    assert.equal(stringify(config), `Host example
  IdentityAgent "~/Library/Group Containers"
`)
  })

  it('.stringify Host entries with multiple patterns', function() {
    const config = parse(`
      Host foo bar  "baz"   "egg ham"
        HostName example.com
    `)

    assert.equal(stringify(config), `
      Host foo bar "baz" "egg ham"
        HostName example.com
    `)
  })

  // #36
  it('.stringify User names with spaces', function() {
    const config = parse(`
      Host example
        User "dan abramov"
    `)

    assert.equal(stringify(config), `
      Host example
        User "dan abramov"
    `)
  })

  // #38
  it('.stringify LocalForward without quotes', function() {
    const config = parse(`
      Host example
        LocalForward 1234 localhost:1234
    `)

    assert.equal(stringify(config), `
      Host example
        LocalForward 1234 localhost:1234
    `)
  })

  it('.stringify multiple LocalForward', function() {
    const config = parse(`
      Host foo
        LocalForward 3128 127.0.0.1:3128
        LocalForward 3000 127.0.0.1:3000
`)

    config.append({
      Host: 'bar',
      LocalForward: [
        '3128 127.0.0.1:3128',
        '3000 127.0.0.1:3000'
      ],
    })

    assert.equal(stringify(config), `
      Host foo
        LocalForward 3128 127.0.0.1:3128
        LocalForward 3000 127.0.0.1:3000

      Host bar
        LocalForward 3128 127.0.0.1:3128
        LocalForward 3000 127.0.0.1:3000
`)
  })

  // #43
  it('.stringify IdentityFile with spaces', function() {
    const config = new SSHConfig().append({
      Host: 'foo',
      IdentityFile: 'C:\\Users\\John Doe\\.ssh\\id_rsa'
    })

    assert.equal(stringify(config), `Host foo
  IdentityFile "C:\\Users\\John Doe\\.ssh\\id_rsa"
`)
  })

  // https://github.com/microsoft/vscode-remote-release/issues/5562
  it('.stringify ProxyCommand with spaces', function() {
    const config = parse(`
      Host foo
        ProxyCommand "C:\\foo bar\\baz.exe" "arg" "arg" "arg"
    `)

    assert.equal(stringify(config), `
      Host foo
        ProxyCommand "C:\\foo bar\\baz.exe" "arg" "arg" "arg"
    `)
  })

  it('.stringify KnownHostsCommand with a quoted executable', function() {
    const config = parse(`
      Host *.sbx
        KnownHostsCommand "/opt/homebrew/bin/sbx" ssh known-hosts %H
    `)

    assert.equal(stringify(config), `
      Host *.sbx
        KnownHostsCommand "/opt/homebrew/bin/sbx" ssh known-hosts %H
    `)
  })

  it('.stringify Match with criteria', function() {
    const config = parse(`
      Match host foo final exec "return 0"
        HostName localhost
    `)
    assert.equal(stringify(config), `
      Match host foo final exec "return 0"
        HostName localhost
    `)
  })

  // https://github.com/cyjake/ssh-config/issues/84
  it('.stringify ProxyCommand with =', function() {
    const config = parse(`
      Host YYYY
        HostName YYYY
        IdentityFile ~/.ssh/id_rsa
        StrictHostKeyChecking no
        UserKnownHostsFile /dev/null
        ProxyCommand ssh -i ~/.ssh/id_rsa -W %h:%p -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null XXX@ZZZ
        User XXX
    `)
    assert.equal(stringify(config), `
      Host YYYY
        HostName YYYY
        IdentityFile ~/.ssh/id_rsa
        StrictHostKeyChecking no
        UserKnownHostsFile /dev/null
        ProxyCommand ssh -i ~/.ssh/id_rsa -W %h:%p -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null XXX@ZZZ
        User XXX
    `)
  })

  // https://github.com/cyjake/ssh-config/issues/125
  it('.stringify retains spaces before trailing comments', function() {
    const src = 'Host web # prod box\n  IdentityFile ~/.ssh/id_web # deploy key\n'
    const config = parse(src)
    assert.equal(stringify(config), src)
    // the stringified output reparses to the same config
    assert.deepEqual(parse(stringify(config)).compute('web'), config.compute('web'))
    assert.equal(parse(stringify(config)).compute('web').Host, 'web')
  })

  // https://github.com/cyjake/ssh-config/issues/125
  it('.stringify escapes double quotes inside quoted values', function() {
    const src = 'Host web\n  User "a\\"b"\n'
    const config = parse(src)
    assert.equal(config[0].type, SSHConfig.DIRECTIVE)
    assert.equal((config[0] as Section).config[0].type, SSHConfig.DIRECTIVE)
    assert.equal(((config[0] as Section).config[0] as Directive).value, 'a"b')
    assert.equal(stringify(config), src)
    assert.equal(parse(stringify(config)).compute('web').User, 'a"b')
  })
})
