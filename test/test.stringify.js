'use strict'

const assert = require('assert').strict || require('assert')
const fs = require('fs')
const heredoc = require('heredoc').strip
const path = require('path')
const SSHConfig = require('..')
const { parse, stringify } = SSHConfig

function readFile(fpath) {
  return fs.readFileSync(path.join(__dirname, fpath), 'utf-8')
    .replace(/\r\n/g, '\n')
}

describe('stringify', function() {
  it('.stringify the parsed object back to string', function() {
    const fixture = readFile('fixture/config')
    const config = parse(fixture)
    assert.equal(fixture, stringify(config))
  })

  it('.stringify config with white spaces and comments retained', function() {
    const config = parse(heredoc(function() {/*
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    */}))

    assert.equal(stringify(config), heredoc(function() {/*
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    */}))
  })


  it('.stringify IdentityFile entries with double quotes', function() {
    const config = parse(heredoc(function() {/*
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    */}))

    assert.equal(stringify(config), heredoc(function() {/*
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    */}))
  })

  it('.stringify Host entries with multiple patterns', function() {
    const config = parse(heredoc(function() {/*
      Host foo bar  "baz"   "egg ham"
        HostName example.com
    */}))

    assert.equal(stringify(config), heredoc(function() {/*
      Host foo bar baz "egg ham"
        HostName example.com
    */}))
  })

  // #36
  it('.stringify User names with spaces', function() {
    const config = parse(heredoc(function() {/*
      Host example
        User "dan abramov"
    */}))

    assert.equal(stringify(config), heredoc(function() {/*
      Host example
        User "dan abramov"
    */}))
  })

  // #38
  it('.stringify LocalForward without quotes', function() {
    const config = parse(heredoc(function() {/*
      Host example
        LocalForward 1234 localhost:1234
    */}))

    assert.equal(stringify(config), heredoc(function() {/*
      Host example
        LocalForward 1234 localhost:1234
    */}))
  })

  it('.stringify multiple LocalForward', function() {
    const config = parse(heredoc(function() {/*
      Host foo
        LocalForward 3128 127.0.0.1:3128
        LocalForward 3000 127.0.0.1:3000
    */}))

    config.append(  {
      Host: 'bar',
      LocalForward: [
        '3128 127.0.0.1:3128',
        '3000 127.0.0.1:3000'
      ]
    })

    assert.equal(stringify(config), heredoc(function() {/*
      Host foo
        LocalForward 3128 127.0.0.1:3128
        LocalForward 3000 127.0.0.1:3000

      Host bar
        LocalForward 3128 127.0.0.1:3128
        LocalForward 3000 127.0.0.1:3000
    */}))
  })

  // #43
  it('.stringify IdentityFile with spaces', function() {
    const config = new SSHConfig().append({
      Host: 'foo',
      IdentityFile: 'C:\\Users\\John Doe\\.ssh\\id_rsa'
    })

    assert.equal(stringify(config), heredoc(function() {/*
      Host foo
        IdentityFile "C:\Users\John Doe\.ssh\id_rsa"
    */}))
  })
})
