# SSH Config Parser & Stringifier

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
    HostName tahoe1.linode
    User nil
    ProxyCommand ssh -q gateway -W %h:%p
    ForwardAgent true

  Host tahoe2
    HostName tahoe2.linode
    User nil
    ProxyCommand ssh -q gateway -W %h:%p
    ForwardAgent true
*/}))

expect(config).to.eql({
  '0':
   { Host: 'tahoe1',
     HostName: 'tahoe1.linode',
     User: 'nil',
     ProxyCommand: 'ssh -q gateway -W %h:%p',
     ForwardAgent: 'true' },
  '1':
   { Host: 'tahoe2',
     HostName: 'tahoe2.linode',
     User: 'nil',
     ProxyCommand: 'ssh -q gateway -W %h:%p',
     ForwardAgent: 'true' },
  ControlMaster: 'auto',
  ControlPath: '~/.ssh/master-%r@%h:%p',
  IdentityFile: '~/.ssh/id_rsa',
  ServerAliveInterval: '80',
  length: 2
})

// stringify
console.log(sshConfig.stringify(config))
```

## References

- http://linux.die.net/man/5/ssh_config
- http://en.wikibooks.org/wiki/OpenSSH/Client_Configuration_Files#.7E.2F.ssh.2Fconfig
