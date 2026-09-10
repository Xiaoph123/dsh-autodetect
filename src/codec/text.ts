import iconv from 'iconv-lite'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { detectEncoding, isBinary } from './detect.js'
import type { FileMetadata, Newline } from '../shared/types.js'

export function newlineOf(text: string): Newline {
  const match = text.match(/\r\n|\r|\n/)
  return match?.[0] === '\r\n' ? 'crlf' : match?.[0] === '\r' ? 'cr' : 'lf'
}

export function toEditorText(text: string) {
  return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

export async function readFileMetadata(filePath: string): Promise<FileMetadata> {
  const data = await readFile(filePath)
  const detected = detectEncoding(data)
  const binary = isBinary(data, detected.encoding)
  const sha256 = createHash('sha256').update(data).digest('hex')
  if (binary) return { content: '', encoding: detected.encoding, bom: detected.bom, newline: 'lf', size: data.length, sha256, binary: true, extension: extname(filePath).toLowerCase() }
  const text = iconv.decode(detected.body, detected.encoding.replaceAll('-', ''))
  return { content: toEditorText(text), encoding: detected.encoding, bom: detected.bom, newline: newlineOf(text), size: data.length, sha256, binary: false, extension: extname(filePath).toLowerCase() }
}
