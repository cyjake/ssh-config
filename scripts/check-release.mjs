import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const denoJson = JSON.parse(readFileSync(new URL('../deno.json', import.meta.url)))
const tag = process.env.RELEASE_TAG

assert.equal(denoJson.version, packageJson.version, 'package.json and deno.json versions differ')

if (tag) {
  assert.equal(tag, `v${packageJson.version}`, `release tag ${tag} does not match v${packageJson.version}`)
}

console.log(`release metadata is synchronized at ${packageJson.version}`)
