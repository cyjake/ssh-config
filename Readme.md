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
  # Sample config
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


/*
 * config will be something like:
 *
 *   [ { "param": "ControlMaster",
 *       "value": "auto" },
 *     { "param": "ControlPath",
 *       "value": "~/.ssh/master-%r@%h:%p" },
 *     { "param": "IdentityFile",
 *       "value": "~/.ssh/id_rsa" },
 *     { "param": "ServerAliveInterval",
 *       "value": "80" },
 *     { "param": "Host",
 *       "value": "tahoe1",
 *       "config":
 *         [ { "param": "HostName",
 *             "value": "tahoe1.com" } ] },
 *     { "param": "Host",
 *       "value": "tahoe2",
 *       "config":
 *         [ { "param": "HostName",
 *             "value": "tahoe2.com" } ] },
 *     { "param": "Host",
 *       "value": "*",
 *       "config":
 *         [ { "param": "User",
 *             "value": "nil" },
 *           { "param": "ProxyCommand",
 *             "value": "ssh -q gateway -W %h:%p" },
 *           { "param": "ForwardAgent",
 *             "value": "true" } ] } ]
 */


// Change the HostName in the Host tahoe2 section
let section = sshConfig.find({ Host: 'tahoe2' })

section.config.some(line => {
  if (line.param === 'HostName') {
    line.value = 'tahoe2.com.cn'
    return true
  }
})


// stringify with the original format and comments preserved.
console.log(sshConfig.stringify(config))
```


### Iterating Sections

Take the config above as an example, to iterator over sections, a simple for
loop will suffice.

```js
for (let i = 0; i < config.length; i++) {
  let line = config[i]

  // only section have sub config
  if (line.config) {}

  // or to make it explicit, check the parameter name and see if it's Host or Match
  if (line.param === 'Host' || line.param === 'Match') {}
}
```

You can do it in ES2015 fashion too:

```js
// all the sections
config.filter(line => !!line.config)
```

A section is an object that looks like below:

```js
{
  "param": "Host",
  "value": "*",
  "config": [
    {
      "param": "User",
      "value": "nil"
    },
    {
      "param": "ProxyCommand",
      "value": "ssh -q gateway -W %h:%p"
    },
    {
      "param": "ForwardAgent",
      "value": "true"
    }
  ]
}
```


### `.compute` Parameters by Host

But iterating over sections and wild parameters to find the parameters you need
is boring and less efficient. You can use `config.compute` method to compute
apllied parameters of certain host.

```js
expect(config.compute('tahoe2')).to.eql({
  ControlMaster: 'auto',
  ControlPath: '~/.ssh/master-%r@%h:%p',
  IdentityFile: [
    '~/.ssh/id_rsa'
  ],
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

The `IdentityFile` parameter always contain an array to make possible multiple
`IdentityFile` settings to be able to coexist.


### `.find` sections by Host or Match

To ditch boilerplate codes like the for loop shown earlier, we can use the
`.find(opts)` available in the parsed config object.

```js
config.find({ Host: 'example1' })
```

Or you can just brew it yourself:

```js
config.filter(line => line.param === 'Host' && line.value === 'example1').shift()
```


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


### `.append` sections

Starting from version 1.0.0, there's no more `.append` method. Since the config
is now a sub class if Array, you can append with methods like `.push` or `.concat`.

```js
let newSection = sshConfig.parse(`
Host *
  User keanu
`)

config = config.concat(newSection)
config.find({ Host: '*' })

/*
 *
{
  param: 'Host',
  value: '*',
  config: [
    {
      param: 'User',
      value: 'keanu'
    }
  ]
}
 */

```


## References

- [ssh_config(5)][ssh_config]
- [ssh_config(5)][ssh_config_die]
- [ssh_config(5) OpenBSD][ssh_config_openbsd]
- http://en.wikibooks.org/wiki/OpenSSH/Client_Configuration_Files#.7E.2F.ssh.2Fconfig
- http://stackoverflow.com/questions/10197559/ssh-configuration-override-the-default-username


[ssh_config]: https://www.freebsd.org/cgi/man.cgi?query=ssh_config&sektion=5
[ssh_config_die]: http://linux.die.net/man/5/ssh_config
[ssh_config_openbsd]: http://www.openbsd.org/cgi-bin/man.cgi/OpenBSD-current/man5/ssh_config.5?query=ssh_config&arch=i386
