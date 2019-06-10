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
    assert(fixture === stringify(config))
  })

  it('.stringify config with white spaces and comments retained', function() {
    const config = parse(heredoc(function() {/*
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    */}))

    assert(stringify(config) === heredoc(function() {/*
      # Lake tahoe
      Host tahoe4

        HostName tahoe4.com
        # Breeze from the hills
        User keanu
    */}))
  })


  it('.stringify IdentityFile entries with double quotes', function() {
    let config = parse(heredoc(function() {/*
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    */}))

    assert(stringify(config) === heredoc(function() {/*
      Host example
        HostName example.com
        User dan
        IdentityFile "/path to my/.ssh/id_rsa"
    */}))
  })
})
