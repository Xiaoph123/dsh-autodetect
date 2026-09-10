export type Newline = 'lf' | 'crlf' | 'cr'

export type FileMetadata = {
  content: string
  encoding: string
  bom: boolean
  newline: Newline
  size: number
  sha256: string
  binary: boolean
  extension: string
}

export const SUPPORTED_TEXT_EXTENSIONS = new Set(['.bat', '.cmd', '.ini', '.vbs', '.ps1'])
