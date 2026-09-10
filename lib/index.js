import { copyFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, relative, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const HELPER = resolve(ROOT, '..', 'python', 'autodetect_codec.py')
const MAX_BODY = 12 * 1024 * 1024
const name = 'dsh-autodetect'
const inject = ['webServer', 'sessions']

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function requestBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY) throw new Error('request body is too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function pythonCommand() {
  const configured = process.env.AUTODETECT_PYTHON
  if (configured) return { command: configured, args: [] }
  if (process.platform === 'win32') {
    // The Windows Store `python.exe` alias may shadow the real interpreter.
    // Use the Python launcher so the installed charset-normalizer environment
    // is selected consistently; AUTODETECT_PYTHON still overrides this.
    return { command: 'py', args: ['-3'] }
  }
  return { command: 'python3', args: [] }
}

function runCodec(payload) {
  return new Promise((resolvePromise, reject) => {
    const python = pythonCommand()
    const child = spawn(python.command, [...python.args, HELPER], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `codec exited with ${code}`))
      try { resolvePromise(JSON.parse(stdout)) } catch (error) { reject(error) }
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

function sessionCwd(ctx, sessionId, suppliedCwd) {
  const session = ctx.sessions?.get?.(sessionId)
  const cwd = session?.header?.cwd || suppliedCwd
  if (!cwd) throw new Error('session cwd is unavailable')
  return resolve(cwd)
}

function safePath(cwd, requested) {
  const candidate = resolve(cwd, requested)
  const base = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`
  if (candidate !== cwd && !candidate.startsWith(base) && !candidate.toLowerCase().startsWith(base.toLowerCase())) {
    throw new Error('path is outside the session workspace')
  }
  return candidate
}

async function handleRead(ctx, req, res, url) {
  const cwd = sessionCwd(ctx, url.searchParams.get('sessionId'), url.searchParams.get('cwd'))
  const path = safePath(cwd, url.searchParams.get('path') || '')
  const result = await runCodec({ action: 'read', path })
  json(res, 200, result)
}

async function handleWrite(ctx, req, res) {
  const payload = JSON.parse(await requestBody(req))
  const cwd = sessionCwd(ctx, payload.sessionId, payload.cwd)
  const path = safePath(cwd, payload.path || '')
  const original = await readFile(path)
  const currentSha256 = createHash('sha256').update(original).digest('hex')
  if (payload.expectedSha256 && payload.expectedSha256 !== currentSha256) {
    const error = new Error('file changed on disk; reload before saving')
    error.statusCode = 409
    throw error
  }
  const backup = `${path}.autodetect.bak`
  await copyFile(path, backup)
  const result = await runCodec({
    action: 'write',
    path,
    content: payload.content || '',
    encoding: payload.encoding,
    bom: payload.bom,
    newline: payload.newline,
    expectedSha256: currentSha256,
  })
  json(res, 200, { ...result, backup })
}

function apply(ctx) {
  console.error('[dsh-autodetect] host apply')
  if (!ctx.webServer?.register) return
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/autodetect/api',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://dsh.internal')
        if (req.method === 'GET' && url.pathname === '/autodetect/api/read') return await handleRead(ctx, req, res, url)
        if (req.method === 'POST' && url.pathname === '/autodetect/api/write') return await handleWrite(ctx, req, res)
        json(res, 405, { error: 'method not allowed' })
      } catch (error) {
        json(res, error?.statusCode || 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-autodetect: routes')
}

export { apply, inject, name }
