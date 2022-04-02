import SSHConfig from '../..'
import { strict as assert } from 'assert'

describe('SSHConfig (TypeScript)', function() {
  let config: SSHConfig

  beforeEach(function() {
    config = SSHConfig.parse(`
      IdentityFile ~/.ssh/id_rsa

      Host ness
        HostName lochness.com
    `)
  })

  it('.find(line => boolean)', function() {
    const section = config.find(line => line.type === SSHConfig.DIRECTIVE && line.param === 'Host' && line.value === 'ness')
    assert.equal(section.type, SSHConfig.DIRECTIVE)
    assert.equal(section.param, 'Host')
    assert.equal(section.value, 'ness')
  })

  it('.find({ Host })', function() {
    const section = config.find({ Host: 'ness' })
    assert.equal(section.type, SSHConfig.DIRECTIVE)
    if ('config' in section) {
      assert.deepEqual(SSHConfig.stringify(section.config).trim(), 'HostName lochness.com')
    }
  })

  it('.compute(host)', function() {
    const result = config.compute('ness');
    console.log(result)
    assert.deepEqual(result, {
      Host: 'ness',
      HostName: 'lochness.com',
      IdentityFile: [ '~/.ssh/id_rsa' ],
    })
  })

  it('.stringify(config)', function() {
    assert.deepEqual(config.toString(), `
      IdentityFile ~/.ssh/id_rsa

      Host ness
        HostName lochness.com
    `)
  })
})
