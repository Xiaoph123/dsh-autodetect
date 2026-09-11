import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')

test('package metadata identifies the public DSH plugin package', () => {
  assert.equal(packageJson.name, 'dsh-autodetect')
  assert.equal(packageJson.publishConfig?.access, 'public')
  assert.match(packageJson.repository?.url || '', /github\.com[/:]Xiaoph123\/dsh-autodetect/)
})

test('README states the official Harness Web sidebar boundary', () => {
  assert.match(readme, /DeepSeek Harness Web 官方侧边栏/)
  assert.match(readme, /不适配第三方.*侧边栏/)
  assert.match(readme, /npm install dsh-autodetect/)
  assert.match(readme, /0\.2\.0/)
  assert.match(readme, /更新日志/)
  assert.match(readme, /不再需要 Python/)
})

test('package ships a Chinese changelog for published versions', () => {
  assert.ok(packageJson.files.includes('CHANGELOG.md'))
  assert.match(changelog, /## \[0\.2\.0\]/)
  assert.match(changelog, /## \[0\.1\.0\]/)
  assert.match(changelog, /TypeScript 和 Node\.js/)
})

test('package metadata has no Python runtime artifacts', () => {
  assert.ok(!packageJson.files.some((entry) => entry.includes('python') || entry.includes('requirements')))
  assert.equal(packageJson.dependencies['iconv-lite'], '^0.7.3')
  assert.equal(packageJson.dependencies['charset-normalizer'], undefined)
})

test('package declares the official conversation client module', () => {
  assert.ok(packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'))
  assert.equal(packageJson.peerDependencies['@deepseek-ai/dsh-client-ui-conversation'], '*')
})
