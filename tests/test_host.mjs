import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import iconv from 'iconv-lite'

const host = await import('../lib/index.js')

function response() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = body },
  }
}

async function setup() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'autodetect-host-'))
  const file = path.join(cwd, 'sample.bat')
  await writeFile(file, iconv.encode('@echo 中文\r\n', 'gbk'))
  let registration
  const ctx = {
    sessions: { get: () => ({ header: { cwd } }) },
    webServer: { register: (value) => { registration = value; return () => {} } },
    effect: (fn) => fn(),
  }
  host.apply(ctx)
  return { cwd, file, handler: registration.handler }
}

test('host read route returns codec metadata', async () => {
  const { file, handler } = await setup()
  const res = response()
  await handler({ method: 'GET', url: `/autodetect/api/read?sessionId=s&path=${encodeURIComponent(path.basename(file))}` }, res)
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.body).encoding, 'gbk')
})

test('host write route creates backup and preserves encoding', async () => {
  const { cwd, file, handler } = await setup()
  const readRes = response()
  await handler({ method: 'GET', url: `/autodetect/api/read?sessionId=s&path=${encodeURIComponent(path.basename(file))}` }, readRes)
  const metadata = JSON.parse(readRes.body)
  const res = response()
  await handler({ method: 'POST', url: '/autodetect/api/write', async *[Symbol.asyncIterator]() { yield JSON.stringify({ sessionId: 's', path: path.basename(file), content: '@echo 修改\n', encoding: 'gbk', bom: false, newline: 'crlf', expectedSha256: metadata.sha256 }) } }, res)
  assert.equal(res.status, 200)
  assert.deepEqual(await readFile(file), iconv.encode('@echo 修改\r\n', 'gbk'))
  assert.deepEqual(await readFile(`${file}.autodetect.bak`), iconv.encode('@echo 中文\r\n', 'gbk'))
  assert.equal(JSON.parse(res.body).backup, `${file}.autodetect.bak`)
  assert.equal(cwd.length > 0, true)
})

test('host rejects external modification with HTTP 409', async () => {
  const { file, handler } = await setup()
  const readRes = response()
  await handler({ method: 'GET', url: `/autodetect/api/read?sessionId=s&path=${encodeURIComponent(path.basename(file))}` }, readRes)
  const metadata = JSON.parse(readRes.body)
  await writeFile(file, iconv.encode('@echo 外部修改\r\n', 'gbk'))
  const res = response()
  await handler({ method: 'POST', url: '/autodetect/api/write', async *[Symbol.asyncIterator]() { yield JSON.stringify({ sessionId: 's', path: path.basename(file), content: '@echo 覆盖', encoding: 'gbk', bom: false, newline: 'crlf', expectedSha256: metadata.sha256 }) } }, res)
  assert.equal(res.status, 409)
  assert.match(res.body, /changed on disk/)
})

test('host rejects path traversal', async () => {
  const { handler } = await setup()
  const res = response()
  await handler({ method: 'GET', url: '/autodetect/api/read?sessionId=s&path=..%2Foutside.bat' }, res)
  assert.equal(res.status, 400)
  assert.match(res.body, /outside the session workspace/)
})
