import assert from 'node:assert/strict'
import test from 'node:test'
import { appendToConversation, appendToInput } from '../lib/conversation.js'

function fakeConversation(initialDraft = '') {
  const state = { draft: initialDraft }
  const writes = []
  const input = {
    state: { getSnapshot: () => ({ draft: state.draft }) },
    setDraft: (value) => { state.draft = value; writes.push(value) },
  }
  return {
    value: { input: { for: (scope) => { assert.equal(scope, sessionScope); return input } } },
    state,
    writes,
  }
}

const sessionScope = {}

test('appendToConversation writes selected text into an empty session draft', () => {
  const fake = fakeConversation()
  assert.equal(appendToConversation(fake.value, sessionScope, '```a.txt:1\nhello\n```'), true)
  assert.deepEqual(fake.writes, ['```a.txt:1\nhello\n```'])
})

test('appendToInput uses the official session inputActions facade', () => {
  const writes = []
  assert.equal(appendToInput({ draft: '' }, { setDraft: (value) => writes.push(value) }, 'selected text'), true)
  assert.deepEqual(writes, ['selected text'])
})

test('appendToConversation appends selected text to an existing draft', () => {
  const fake = fakeConversation('请检查这段代码')
  assert.equal(appendToConversation(fake.value, sessionScope, '```a.txt:2\nworld\n```'), true)
  assert.deepEqual(fake.writes, ['请检查这段代码 ```a.txt:2\nworld\n```'])
})

test('appendToConversation returns false when the injected API is unavailable or throws', () => {
  assert.equal(appendToConversation(undefined, sessionScope, 'text'), false)
  const broken = { input: { for: () => { throw new Error('scope unavailable') } } }
  assert.equal(appendToConversation(broken, { sessionId: 'session-1' }, 'text'), false)
})
