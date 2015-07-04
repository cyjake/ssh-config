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


### `.query` Parameters by Host

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


### `.find` sections by Host or other criteria

To ditch boilerplate codes like the for loop shown earlier, we can use the
`.find(opts)` available in the parsed config object.

```js
var config = sshConfig.parse(/* ssh config text */)

config.find({ Host: 'example1' })
config.find({ HostName: 'example1.com' })
config.find({ User: 'keanu' })
// you've got the idea.
```

**NOTICE** Like the way we handle parameter values, the first section that
matches all the criteria passed in will be returned. `.find` won't bother to
find them all.


### `.remove` sections by Host or other criteria

To remove sections, we can pass the section to `.remove(opts)`.

```js
var config = sshConfig.parse(/* ssh config text */)

// find the section you want to remove, and remove it.
var section = config.find({ Host: 'example1' })
config.remove(section)

// or you can put it in one statement
config.remove({ Host: 'example1' })
```

**NOTICE** Unlike `.find`, `.remove` finds and removes ALL the macthed sections.
So please be specific about the criteria you provide.

If the provided opts were something like `{ User: 'keanu' }`, all sections that
has `User` set to `keanu` will be removed.


### `.append` sections


To append new sections, use `.append(section)` method.

```js
var config = sshConfig.parse(/* ssh config text */)

config.append({
  Host: 'example2',
  HostName: 'example2.com'
})

// not you can query settings about example2
config.query('example2')
```

**NOTICE** only `Host` and `Match` can start new sections. So please provide
any one of them in your section that needs to be appended. Besides, to make the
config object legitimate, you can not append dupilcated `Host`s or `Match`es.


## References

- [ssh_config(5)][ssh_config]
- [ssh_config(5) OpenBSD][ssh_config_openbsd]
- http://en.wikibooks.org/wiki/OpenSSH/Client_Configuration_Files#.7E.2F.ssh.2Fconfig
- http://stackoverflow.com/questions/10197559/ssh-configuration-override-the-default-username


[ssh_config]: http://linux.die.net/man/5/ssh_config
[ssh_config_openbsd]: http://www.openbsd.org/cgi-bin/man.cgi/OpenBSD-current/man5/ssh_config.5?query=ssh_config&arch=i386
