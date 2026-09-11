import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

test('client bundle preserves the Harness module loader contract', () => {
  assert.match(client, /__ModuleLoader__\.load/)
  assert.match(client, /dsh-autodetect/)
  assert.match(client, /sidebarRightTabs/)
  assert.match(client, /dsh-resource:\/\/file/)
  assert.match(client, /autodetect\/api\/read/)
  assert.match(client, /autodetect\/api\/write/)
  assert.match(client, /ctx\.sidebarRightTabs\.register/)
  assert.match(client, /sessions\?\.scope/)
  assert.match(client, /conversation \|\| .*get\?\.\("conversation"\)/)
  assert.doesNotMatch(client, /ctx\.inject\(\["conversation", "sessions"\]/)
  assert.match(client, /AutoDetectErrorBoundary/)
  assert.match(client, /const inject = \["slots", "sidebarRightTabs", "conversation", "sessions"\]/)
  assert.match(client, /onPointerDown: handleAddSelectionPointerDown/)
})

test('client bundle contains injected CSS marker', () => {
  assert.match(client, /dsh-autodetect-styles/)
})
