'use strict'

var heredoc = require('heredoc').strip
var sshConfig = require('./index')


var config = sshConfig.parse(heredoc(function() {/*
  Host example
    HostName example.com
    User root
    Port 22
    IdentityFile /path/to/key

  Host example1
    HostName example1.com
    User simon
    Port 1000
    IdentityFile /path/to/key
*/}))

config.append({
  Host: 'example2',
  HostName: 'example2.com',
  User: 'simon',
  Port: 1000,
  IdentityFile: '/path/to/other/key'
})


console.log(sshConfig.stringify(config))
