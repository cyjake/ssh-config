
import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import SSHConfig from '../..'

const { parse, stringify } = SSHConfig

function readFile(fname) {
  const fpath = path.join(__dirname, '..', fname)
  return fs.readFileSync(fpath, 'utf-8').replace(/\r\n/g, '\n')
}

describe('stringify', function() {
  it('.stringify the parsed object back to string', async function() {
    const fixture = readFile('fixture/config')
    const config = parse(fixture)
    assert.equal(fixture, stringify(config))
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
      Host foo bar baz "egg ham"
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
        ProxyCommand "C:\foo bar\baz.exe" "arg" "arg" "arg"
    `)

    assert.equal(stringify(config), `
      Host foo
        ProxyCommand "C:\foo bar\baz.exe" arg arg arg
    `)
  })

  it('.stringify Match with criteria', function() {
    const config = parse(`
      Match host foo exec "return 0"
        HostName localhost
    `)
    assert.equal(stringify(config), `
      Match host foo exec "return 0"
        HostName localhost
    `)
  })
})
