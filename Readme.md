# SSH Config Parser & Stringifier

[![NPM Downloads](https://img.shields.io/npm/dm/ssh-config.svg?style=flat)](https://www.npmjs.com/package/ssh-config)
[![NPM Version](http://img.shields.io/npm/v/ssh-config.svg?style=flat)](https://www.npmjs.com/package/ssh-config)
[![Build Status](https://travis-ci.org/cyjake/ssh-config.svg)](https://travis-ci.org/cyjake/ssh-config)
[![Node CI](https://github.com/cyjake/ssh-config/actions/workflows/nodejs.yml/badge.svg)](https://github.com/cyjake/ssh-config/actions/workflows/nodejs.yml)
[![codecov](https://codecov.io/gh/cyjake/ssh-config/branch/master/graph/badge.svg?token=RMyTgcL8Kg)](https://codecov.io/gh/cyjake/ssh-config)

## Usage

```js
const SSHConfig = require('ssh-config')

const config = SSHConfig.parse(`
  IdentityFile ~/.ssh/id_rsa

  Host tahoe
    HostName tahoe.com

  Host walden
    HostName waldenlake.org

  Host *
    User keanu
    ForwardAgent true
`)

expect(config).to.eql(
  [ { "param": "IdentityFile",
      "value": "~/.ssh/id_rsa" },
    { "param": "Host",
      "value": "tahoe",
      "config":
        [ { "param": "HostName",
            "value": "tahoe.com" } ] },
    { "param": "Host",
      "value": "walden",
      "config":
        [ { "param": "HostName",
            "value": "waldenlake.org" } ] },
    { "param": "Host",
      "value": "*",
      "config":
        [ { "param": "User",
            "value": "keanu" },
          { "param": "ForwardAgent",
            "value": "true" } ] } ]
)

// Change the HostName in the Host walden section
const section = config.find({ Host: 'walden' })

for (const line of section.config) {
  if (line.param === 'HostName') {
    line.value = 'waldenlake.org'
    break
  }
}

// The original whitespaces and comments are preserved.
console.log(SSHConfig.stringify(config))
// console.log(config.toString())
```

### Iterating over Sections

One needs to iterate over ssh configs mostly because of two reasons.

- to `.find` the corresponding section and modify it, or
- to `.compute` the ssh config about certain `Host`.


### `.compute` Parameters by Host

You can use `config.compute` method to compute applied parameters of certain host.

```js
expect(config.compute('walden')).to.eql({
  IdentityFile: [
    '~/.ssh/id_rsa'
  ],
  Host: 'walden',
  HostName: 'waldenlake.org',
  User: 'nil',
  ForwardAgent: 'true'
})
```

**NOTICE** According to [ssh_config(5)][ssh_config], the first obtained
parameter value will be used. So we cannot override existing parameters. It is
suggested that the general settings shall be at the end of your config file.

The `IdentityFile` parameter always contain an array to make possible multiple
`IdentityFile` settings to be able to coexist.

### `.find` sections by Host or Match

**NOTICE**: This method is provided to find the corresponding section in the
parsed config for config manipulation. It is NOT intended to compute config
of certain Host. For latter case, use `.compute(host)` instead.

To ditch boilerplate codes like the for loop shown earlier, we can use the
`.find(opts)` available in the parsed config object.

```js
config.find({ Host: 'example1' })
// or the ES2015 Array.prototype.find
config.find(line => line.param == 'Host' && line.value == 'example1')
```

### `.remove` sections by Host / Match or function

To remove sections, we can pass the section to `.remove(opts)`.

```js
config.remove({ Host: 'example1' })
// or the ES2015 Array.prototype.find
config.remove(line => line.param == 'Host' && line.value == 'example1')
```

### `.append` sections

Since the parsed config is a sub class of Array, you can append new sections with methods like `.push` or `.concat`.

```js
config.push(...SSHConfig.parse(`
Host ness
  HostName lochness.com
  User dinosaur
`))

expect(config.find({ Host: '*' })).to.eql(
  { "param": "Host",
    "value": "ness",
    "config":
     [ { "param": "HostName",
         "value": "lochness.com" } ] }
)
```

If the section to append is vanilla JSON, `.append` is what you need.

```js
const config = new SSHConfig()

config.append({
  Host: 'ness',
  HostName: 'lochness.com',
  User: 'dinosaur'
})

SSHConfig.stringify(config)
// =>
// Host ness
//   HostName lochness.com
//   User dinosaur
```

### `.prepend` sections

But appending options to the end of the config isn't very effective if your config is organizated per the recommendations of ssh_config(5) that the generic options are at at the end of the config, such as:

```
Host ness
  HostName lochness.com
  User dinosaur

IdentityFile ~/.ssh/id_rsa
```

The config could get messy if you put new options after the line of `IdentityFile`. To work around this issue, it is recommended that `.prepend` should be used instead. For the example above, we can prepend new options at the beginning of the config:

```js
config.prepend({
  Host: 'tahoe',
  HostName 'tahoe.com',
})
```

The result would be:

```
Host tahoe
  HostName tahoe.com

Host ness
  HostName lochness.com
  User dinosaur

IdentityFile ~/.ssh/id_rsa
```

If there are generic options at the beginning of the config, and you'd like the prepended section put before the first existing section, please turn on the second argument of `.prepend`:

```js
config.prepend({
  Host: 'tahoe',
  HostName 'tahoe.com',
}, true)
```

The result would be like:

```
IdentityFile ~/.ssh/id_rsa

Host tahoe
  HostName tahoe.com

Host ness
  HostName lochness.com
  User dinosaur
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
