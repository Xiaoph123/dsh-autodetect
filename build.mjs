import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

const css = await readFile('src/client/styles.css', 'utf8')

await build({
  entryPoints: ['src/codec/index.ts'],
  outfile: 'lib/codec.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  external: ['iconv-lite'],
  sourcemap: false,
})

await build({
  entryPoints: ['src/host/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  external: ['iconv-lite'],
  sourcemap: false,
})

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  banner: { js: `(() => { const css = ${JSON.stringify(css)}; if (typeof document !== 'undefined' && !document.getElementById('dsh-autodetect-styles')) { const style = document.createElement('style'); style.id = 'dsh-autodetect-styles'; style.textContent = css; document.head.appendChild(style) } })();` },
  sourcemap: false,
})

await build({
  entryPoints: ['src/client/conversation.ts'],
  outfile: 'lib/conversation.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
})
