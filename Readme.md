# SSH Config Parser & Stringifier

[![NPM Downloads](https://img.shields.io/npm/dm/ssh-config.svg?style=flat)](https://www.npmjs.com/package/ssh-config)
[![NPM Version](http://img.shields.io/npm/v/ssh-config.svg?style=flat)](https://www.npmjs.com/package/ssh-config)
[![Build Status](https://travis-ci.org/dotnil/ssh-config.svg)](https://travis-ci.org/dotnil/ssh-config)


## Usage

```js
var sshConfig = require('ssh-config')
var heredoc = require('heredoc')
var expect = require('expect.js')

// parse
var config = sshConfig.parse(heredoc(function() {/*
  ControlMaster auto
  ControlPath ~/.ssh/master-%r@%h:%p
  IdentityFile ~/.ssh/id_rsa
  ServerAliveInterval 80

  Host tahoe1
    HostName tahoe1.com

  Host tahoe2
    HostName tahoe2.com

  Host *
    User nil
    ProxyCommand ssh -q gateway -W %h:%p
    ForwardAgent true
*/}))

expect(config).to.eql({
  '0':
   { Host: 'tahoe1',
     HostName: 'tahoe1.com' },
  '1':
   { Host: 'tahoe2',
     HostName: 'tahoe2.com' },
  '2':
   { Host: '*',
     User: 'nil',
     ProxyCommand: 'ssh -q gateway -W %h:%p',
     ForwardAgent: 'true' },
  ControlMaster: 'auto',
  ControlPath: '~/.ssh/master-%r@%h:%p',
  IdentityFile: '~/.ssh/id_rsa',
  ServerAliveInterval: '80'
})

// stringify
console.log(sshConfig.stringify(config))
```


### Iterating Sections

There's a hidden `config.length` property that can be used to iterate over the
parsed sections.

```js
for (var i = 0, len = config.length; i < len; i++) {
  var section = config[i]
  console.log(section)
}
```

If the wild parameters is the ones you concern about:

```js
for (var p in config) {
  if (+p < config.length) continue
  console.log(p, config[p])
}
```


### Query Parameters by Host

But iterating over sections and wild parameters to find the parameters you need
is boring and error prone. You can use `config.query` method to query parameters
by Host.

```js
expect(config.query('tahoe2')).to.eql({
  ControlMaster: 'auto',
  ControlPath: '~/.ssh/master-%r@%h:%p',
  IdentityFile: '~/.ssh/id_rsa',
  ServerAliveInterval: '80',
  Host: 'tahoe2',
  HostName: 'tahoe2.com',
  User: 'nil',
  ProxyCommand: 'ssh -q gateway -W %h:%p',
  ForwardAgent: 'true'
})
```

**NOTICE** According to [ssh_config(5)][ssh_config], the first obtained
parameter value will be used. So we cannot override existing parameters. It is
suggested that the general settings shall be at the end of your config file.

Both `config.length` and `config.query` won't appear when you iterate over
config object.


## References

- [ssh_config(5)][ssh_config]
- [ssh_config(5) OpenBSD][ssh_config_openbsd]
- http://en.wikibooks.org/wiki/OpenSSH/Client_Configuration_Files#.7E.2F.ssh.2Fconfig
- http://stackoverflow.com/questions/10197559/ssh-configuration-override-the-default-username


[ssh_config]: http://linux.die.net/man/5/ssh_config
[ssh_config_openbsd]: http://www.openbsd.org/cgi-bin/man.cgi/OpenBSD-current/man5/ssh_config.5?query=ssh_config&arch=i386
