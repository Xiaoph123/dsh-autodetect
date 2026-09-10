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
})
