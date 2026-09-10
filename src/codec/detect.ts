import iconv from 'iconv-lite'

export type DetectedEncoding = { encoding: string; bom: boolean; body: Buffer }

const BOMS: Array<[Buffer, string]> = [
  [Buffer.from([0xff, 0xfe, 0, 0]), 'utf-32-le'],
  [Buffer.from([0, 0, 0xfe, 0xff]), 'utf-32-be'],
  [Buffer.from([0xff, 0xfe]), 'utf-16-le'],
  [Buffer.from([0xfe, 0xff]), 'utf-16-be'],
  [Buffer.from([0xef, 0xbb, 0xbf]), 'utf-8'],
]

const COMMON_ENCODINGS = new Set(['utf-8', 'gbk', 'gb18030', 'utf-16-le', 'utf-16-be', 'utf-32-le', 'utf-32-be', 'cp1252', 'shift-jis'])

function iconvName(encoding: string) {
  return encoding.replaceAll('-', '') === 'utf8' ? 'utf8' : encoding.replaceAll('-', '')
}

export function isReversible(data: Buffer, encoding: string) {
  try {
    const text = iconv.decode(data, iconvName(encoding))
    return iconv.encode(text, iconvName(encoding)).equals(data)
  } catch {
    return false
  }
}

function looksLikeBomlessUtf16(data: Buffer, encoding: 'utf-16-le' | 'utf-16-be') {
  if (data.length < 16 || data.length % 2 !== 0) return false
  let evenNuls = 0
  let oddNuls = 0
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === 0) {
      if (index % 2 === 0) evenNuls += 1
      else oddNuls += 1
    }
  }
  const half = data.length / 2
  const skewed = encoding === 'utf-16-le'
    ? oddNuls * 10 >= half * 3 && evenNuls * 20 <= half
    : evenNuls * 10 >= half * 3 && oddNuls * 20 <= half
  if (!skewed) return false
  try {
    const text = iconv.decode(data, iconvName(encoding))
    return !text.includes('\ufffd')
  } catch {
    return false
  }
}

export function detectEncoding(data: Buffer): DetectedEncoding {
  for (const [marker, encoding] of BOMS) {
    if (data.subarray(0, marker.length).equals(marker)) return { encoding, bom: true, body: data.subarray(marker.length) }
  }
  if (data.length === 0) return { encoding: 'utf-8', bom: false, body: data }
  if (isReversible(data, 'utf-8')) return { encoding: 'utf-8', bom: false, body: data }
  for (const encoding of ['utf-16-le', 'utf-16-be'] as const) {
    if (looksLikeBomlessUtf16(data, encoding)) return { encoding, bom: false, body: data }
  }
  if (isReversible(data, 'gbk')) return { encoding: 'gbk', bom: false, body: data }
  if (isReversible(data, 'gb18030')) return { encoding: 'gb18030', bom: false, body: data }
  for (const encoding of ['cp1252', 'shift-jis']) {
    if (isReversible(data, encoding)) return { encoding, bom: false, body: data }
  }
  return { encoding: 'utf-8', bom: false, body: data }
}

export function isBinary(data: Buffer, encoding: string) {
  if (!data.length) return false
  if (encoding.startsWith('utf-16') || encoding.startsWith('utf-32')) return false
  if (data.includes(0)) return true
  let controls = 0
  for (const byte of data) if (byte < 8 || (byte >= 14 && byte < 32)) controls += 1
  return controls / data.length > 0.02
}

export { COMMON_ENCODINGS }
