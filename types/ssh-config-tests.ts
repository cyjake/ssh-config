import SSHConfig from './index';

const config = SSHConfig.parse(`
IdentityFile ~/.ssh/id_rsa

Host ness
  HostName lochness.com
`);

console.log(config.toString());
