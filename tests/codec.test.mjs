import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import iconv from 'iconv-lite'

const codec = await import('../lib/codec.js')

test('reads GBK without mojibake and remembers CRLF', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.bat')
  await writeFile(file, iconv.encode('@echo 中文\r\n', 'gbk'))
  const value = await codec.readFile(file)
  assert.equal(value.encoding, 'gbk')
  assert.equal(value.newline, 'crlf')
  assert.equal(value.content, '@echo 中文\n')
})

test('writes GBK and CRLF without adding a BOM', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.ps1')
  await writeFile(file, iconv.encode('Write-Output 中文\r\n', 'gbk'))
  await codec.writeFile(file, { content: 'Write-Output 修改\n', encoding: 'gbk', bom: false, newline: 'crlf' })
  assert.deepEqual(await readFile(file), iconv.encode('Write-Output 修改\r\n', 'gbk'))
})

test('preserves UTF-8 BOM and round trips bytes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.cmd')
  const original = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('@echo 中文\r\n')])
  await writeFile(file, original)
  const value = await codec.readFile(file)
  assert.equal(value.encoding, 'utf-8')
  assert.equal(value.bom, true)
  assert.deepEqual(codec.encodeText(value.content, value.encoding, value.bom, value.newline), original)
})

test('detects BOM-less UTF-16LE and round trips bytes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.ini')
  const original = iconv.encode('[配置]\r\n名称=中文\r\n', 'utf-16-le')
  await writeFile(file, original)
  const value = await codec.readFile(file)
  assert.equal(value.encoding, 'utf-16-le')
  assert.equal(value.bom, false)
  assert.equal(value.content, '[配置]\n名称=中文\n')
  await codec.writeFile(file, { ...value, expectedSha256: value.sha256 })
  assert.deepEqual(await readFile(file), original)
})

test('detects GB18030 four-byte text', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.cmd')
  await writeFile(file, iconv.encode('echo 𠀀\r\n', 'gb18030'))
  const value = await codec.readFile(file)
  assert.equal(value.encoding, 'gb18030')
  assert.equal(value.content, 'echo 𠀀\n')
})

test('rejects binary content as editable text', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.ps1')
  await writeFile(file, Buffer.from([0x4d, 0x5a, 0, 1, 2, 3, 0, 0xff]))
  const value = await codec.readFile(file)
  assert.equal(value.binary, true)
})

test('refuses external modification before writing', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autodetect-'))
  const file = path.join(directory, 'sample.vbs')
  await writeFile(file, iconv.encode('原始\r\n', 'gbk'))
  const value = await codec.readFile(file)
  await writeFile(file, iconv.encode('外部修改\r\n', 'gbk'))
  await assert.rejects(() => codec.writeFile(file, { content: '覆盖', encoding: 'gbk', bom: false, newline: 'crlf', expectedSha256: value.sha256 }), /changed on disk/)
  assert.deepEqual(await readFile(file), iconv.encode('外部修改\r\n', 'gbk'))
})
