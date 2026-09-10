import { createHash } from 'node:crypto'
import { readFile as readBytes } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { readFileMetadata } from '../codec/text.js'
import { writeFile as writeEncoded } from '../codec/encode.js'
import { SUPPORTED_TEXT_EXTENSIONS } from '../shared/types.js'

export function safePath(cwd: string, requested: string) {
  const baseCwd = resolve(cwd)
  const candidate = resolve(baseCwd, requested)
  const base = baseCwd.endsWith(sep) ? baseCwd : `${baseCwd}${sep}`
  if (candidate !== baseCwd && !candidate.startsWith(base) && !candidate.toLowerCase().startsWith(base.toLowerCase())) throw new Error('path is outside the session workspace')
  return candidate
}

function assertSupported(filePath: string) {
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) throw new Error(`unsupported file extension: ${extension || '<none>'}`)
}

export async function readFile(filePath: string) {
  assertSupported(filePath)
  return readFileMetadata(filePath)
}

export async function writeFile(filePath: string, options: { content: string; encoding: string; bom: boolean; newline: 'lf' | 'crlf' | 'cr'; expectedSha256?: string }) {
  assertSupported(filePath)
  return writeEncoded(filePath, options)
}

export async function sha256(filePath: string) {
  return createHash('sha256').update(await readBytes(filePath)).digest('hex')
}
