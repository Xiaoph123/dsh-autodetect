import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

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
  assert.match(readme, /不再需要 Python/)
})

test('package metadata has no Python runtime artifacts', () => {
  assert.ok(!packageJson.files.some((entry) => entry.includes('python') || entry.includes('requirements')))
  assert.equal(packageJson.dependencies['iconv-lite'], '^0.7.3')
  assert.equal(packageJson.dependencies['charset-normalizer'], undefined)
})
