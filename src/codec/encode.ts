import iconv from 'iconv-lite'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, open } from 'node:fs/promises'
import { dirname, basename, join } from 'node:path'
import type { Newline } from '../shared/types.js'

const BOM = new Map<string, Buffer>([
  ['utf-8', Buffer.from([0xef, 0xbb, 0xbf])],
  ['utf-16-le', Buffer.from([0xff, 0xfe])],
  ['utf-16-be', Buffer.from([0xfe, 0xff])],
  ['utf-32-le', Buffer.from([0xff, 0xfe, 0, 0])],
  ['utf-32-be', Buffer.from([0, 0, 0xfe, 0xff])],
])

export function encodeText(content: string, encoding: string, bom: boolean, newline: Newline) {
  const separator = newline === 'crlf' ? '\r\n' : newline === 'cr' ? '\r' : '\n'
  const normalized = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', separator)
  const raw = iconv.encode(normalized, encoding.replaceAll('-', ''))
  return bom && BOM.has(encoding) ? Buffer.concat([BOM.get(encoding)!, raw]) : raw
}

async function atomicWrite(filePath: string, data: Buffer) {
  await mkdir(dirname(filePath), { recursive: true })
  const temporary = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporary, filePath)
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function writeFile(filePath: string, options: { content: string; encoding: string; bom: boolean; newline: Newline; expectedSha256?: string }) {
  const current = await readFile(filePath)
  const currentSha256 = createHash('sha256').update(current).digest('hex')
  if (options.expectedSha256 && options.expectedSha256 !== currentSha256) throw new Error('file changed on disk; reload before saving')
  await copyFile(filePath, `${filePath}.autodetect.bak`)
  const data = encodeText(options.content, options.encoding, options.bom, options.newline)
  await atomicWrite(filePath, data)
  return { ok: true, size: data.length, sha256: createHash('sha256').update(data).digest('hex') }
}
