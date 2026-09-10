import { readFile as readWorkspaceFile, safePath, writeFile as writeWorkspaceFile } from './file-service.js'

const MAX_BODY = 12 * 1024 * 1024
export const name = 'dsh-autodetect'
export const inject = ['webServer', 'sessions']

function json(res: any, status: number, value: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function requestBody(req: AsyncIterable<Buffer | string>) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY) throw new Error('request body is too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sessionCwd(ctx: any, sessionId: string | null, suppliedCwd?: string | null) {
  const cwd = ctx.sessions?.get?.(sessionId)?.header?.cwd || suppliedCwd
  if (!cwd) throw new Error('session cwd is unavailable')
  return cwd
}

async function handleRead(ctx: any, res: any, url: URL) {
  const cwd = sessionCwd(ctx, url.searchParams.get('sessionId'), url.searchParams.get('cwd'))
  const filePath = safePath(cwd, url.searchParams.get('path') || '')
  json(res, 200, await readWorkspaceFile(filePath))
}

async function handleWrite(ctx: any, req: any, res: any) {
  const payload = JSON.parse(await requestBody(req))
  const cwd = sessionCwd(ctx, payload.sessionId, payload.cwd)
  const filePath = safePath(cwd, payload.path || '')
  const result = await writeWorkspaceFile(filePath, {
    content: payload.content || '',
    encoding: payload.encoding,
    bom: Boolean(payload.bom),
    newline: payload.newline,
    expectedSha256: payload.expectedSha256,
  })
  json(res, 200, { ...result, backup: `${filePath}.autodetect.bak` })
}

export function apply(ctx: any) {
  if (!ctx.webServer?.register) return
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/autodetect/api',
    handler: async (req: any, res: any) => {
      try {
        const url = new URL(req.url || '/', 'http://dsh.internal')
        if (req.method === 'GET' && url.pathname === '/autodetect/api/read') return await handleRead(ctx, res, url)
        if (req.method === 'POST' && url.pathname === '/autodetect/api/write') return await handleWrite(ctx, req, res)
        json(res, 405, { error: 'method not allowed' })
      } catch (error: any) {
        const status = error?.message === 'file changed on disk; reload before saving' ? 409 : 400
        json(res, status, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-autodetect: routes')
}
