import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'ssh-config-package-'))
const consumer = join(temporaryRoot, 'consumer')
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(temporaryRoot, 'npm-cache'),
}

try {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  execFileSync('npm', ['pack', '--pack-destination', temporaryRoot], {
    cwd: root,
    env: npmEnvironment,
    stdio: 'inherit',
  })

  const tarball = join(temporaryRoot, `${packageJson.name}-${packageJson.version}.tgz`)
  mkdirSync(consumer)
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  execFileSync('npm', ['install', '--ignore-scripts', '--no-package-lock', tarball], {
    cwd: consumer,
    env: npmEnvironment,
    stdio: 'inherit',
  })

  writeFileSync(join(consumer, 'commonjs.cjs'), `
    const assert = require('node:assert').strict
    const sshConfig = require('ssh-config')
    assert.equal(typeof sshConfig.parse, 'function')
    assert.equal(sshConfig.parse('Host example\\n  User root\\n').compute('example').User, 'root')
  `)
  writeFileSync(join(consumer, 'module.mjs'), `
    import assert from 'node:assert/strict'
    import SSHConfig, { parse } from 'ssh-config'
    assert.equal(typeof SSHConfig, 'function')
    assert.equal(parse('Host example\\n  User root\\n').compute('example').User, 'root')
  `)
  writeFileSync(join(consumer, 'types.ts'), `
    import SSHConfig, { parse } from 'ssh-config'
    const parsed: SSHConfig = parse('Host example\\n')
    parsed.compute('example')
  `)

  execFileSync(process.execPath, ['commonjs.cjs'], { cwd: consumer, stdio: 'inherit' })
  execFileSync(process.execPath, ['module.mjs'], { cwd: consumer, stdio: 'inherit' })
  execFileSync(process.execPath, [
    join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--module', 'Node16',
    '--moduleResolution', 'Node16',
    '--target', 'ES2022',
    '--typeRoots', join(root, 'node_modules', '@types'),
    '--types', 'node',
    'types.ts',
  ], { cwd: consumer, stdio: 'inherit' })
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
