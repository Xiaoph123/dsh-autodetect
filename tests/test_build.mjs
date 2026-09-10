import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

test('build emits DSH host and client entrypoints', async () => {
  await access(new URL('../lib/index.js', import.meta.url))
  await access(new URL('../lib/client.js', import.meta.url))
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(host, /dsh-autodetect/)
  assert.match(client, /__ModuleLoader__\.load/)
})

test('package metadata targets the Python-free 0.2 release', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.version, '0.2.0')
  assert.equal(packageJson.main, './lib/index.js')
  assert.equal(packageJson.exports['./client'], './lib/client.js')
  assert.ok(!packageJson.files.some((entry) => entry.includes('python') || entry.includes('requirements')))
})
