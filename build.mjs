import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const sharedExternal = [
  '@deepseek-ai/*',
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
]

await mkdir('lib', { recursive: true })

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: sharedExternal,
  sourcemap: false,
  logLevel: 'info',
})

const client = await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-locale/client',
  ],
  sourcemap: false,
  write: false,
  logLevel: 'info',
})

let code = client.outputFiles[0]?.text ?? ''
const useStrict = code.startsWith('"use strict";\n') ? '"use strict";\n' : code.startsWith("'use strict';\n") ? "'use strict';\n" : ''
if (useStrict !== '') code = code.slice(useStrict.length)
const wrapped = [
  'window.__ModuleLoader__.load({',
  '  id: "dsh-edit-file-workspace",',
  '  factory: (require) => {',
  useStrict,
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  code,
  '    return module.exports;',
  '  }',
  '});',
  '',
].filter(line => line !== '').join('\n')

await writeFile('lib/client.js', wrapped, 'utf8')
console.log('built lib/index.js and lib/client.js')
