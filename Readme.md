# SSH Config Parser & Stringifier

[![NPM Downloads](https://img.shields.io/npm/dm/ssh-config.svg?style=flat)](https://www.npmjs.com/package/ssh-config)
[![NPM Version](http://img.shields.io/npm/v/ssh-config.svg?style=flat)](https://www.npmjs.com/package/ssh-config)
[![Build Status](https://travis-ci.org/dotnil/ssh-config.svg)](https://travis-ci.org/dotnil/ssh-config)


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

expect(config).to.sql(
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
```


### Iterating Sections

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
```

Or you can just brew it yourself:

```js
config.filter(line => line.param == 'Host' && line.value == 'example1')[0]
```


### `.remove` sections by Host or other criteria

To remove sections, we can pass the section to `.remove(opts)`.

```js
const config = SSHConfig.parse(/* ssh config text */)
config.remove({ Host: 'example1' })
```


### `.append` sections

Since the parsed config is a sub class if Array, you can append new sections with methods like `.push` or `.concat`.

```js
config.push(SSHConfig.parse(`
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


## References

- [ssh_config(5)][ssh_config]
- [ssh_config(5)][ssh_config_die]
- [ssh_config(5) OpenBSD][ssh_config_openbsd]
- http://en.wikibooks.org/wiki/OpenSSH/Client_Configuration_Files#.7E.2F.ssh.2Fconfig
- http://stackoverflow.com/questions/10197559/ssh-configuration-override-the-default-username


[ssh_config]: https://www.freebsd.org/cgi/man.cgi?query=ssh_config&sektion=5
[ssh_config_die]: http://linux.die.net/man/5/ssh_config
[ssh_config_openbsd]: http://www.openbsd.org/cgi-bin/man.cgi/OpenBSD-current/man5/ssh_config.5?query=ssh_config&arch=i386
