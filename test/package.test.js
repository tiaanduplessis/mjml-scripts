const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { test } = require('node:test')

test('packs only the executable, manifest, readme and license without lifecycle scripts', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mjml-scripts-pack-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', dir
  ], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(dir, 'cache') },
    timeout: 15000
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  const [pack] = JSON.parse(result.stdout)
  assert.deepEqual(pack.files.map(file => file.path).sort(), ['README.md', 'index.js', 'license', 'package.json'])
  assert.equal(pack.files.find(file => file.path === 'index.js').mode & 0o111, 0o111)
  assert.ok(fs.statSync(path.join(dir, pack.filename)).size > 0)
  const manifest = require('../package.json')
  assert.equal(manifest.bin, 'index.js')
  assert.equal(manifest.dependencies.standard, undefined)
  assert.equal(manifest.dependencies.dien, undefined)
  for (const script of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'publish', 'postpublish']) {
    assert.equal(manifest.scripts[script], undefined)
  }
})
