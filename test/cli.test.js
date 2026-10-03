const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const net = require('node:net')
const { spawn, spawnSync } = require('node:child_process')
const { once } = require('node:events')
const { test } = require('node:test')

const cli = process.env.MJML_SCRIPTS_CLI || path.join(__dirname, '..', 'index.js')
const offline = path.join(__dirname, 'offline.cjs')

function fixture (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mjml-scripts-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

function template (text) {
  return `<mjml><mj-head><mj-title>Fixture</mj-title><mj-attributes><mj-all font-family="Arial" /></mj-attributes></mj-head><mj-body><!-- keep me --><mj-section><mj-column><mj-text>${text}</mj-text><mj-button href="https://example.invalid/">Read more</mj-button></mj-column></mj-section></mj-body></mjml>`
}

function write (dir, name, text) {
  const file = path.join(dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function run (dir, args, extraEnv = {}) {
  return spawnSync(process.execPath, ['--require', offline, cli, ...args], {
    cwd: dir,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    timeout: 15000
  })
}

function success (result) {
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
}

async function until (condition, description) {
  const end = Date.now() + 12000
  while (Date.now() < end) {
    if (await condition()) return
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  assert.fail(`Timed out: ${description}`)
}

function start (t, dir, args, extraEnv = {}) {
  const child = spawn(process.execPath, ['--require', offline, cli, ...args], {
    cwd: dir,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const force = setTimeout(() => child.kill('SIGKILL'), 3000)
    await exited
    clearTimeout(force)
    assert.notEqual(child.signalCode, 'SIGKILL', 'test child must shut down cleanly')
  })
  return { child, output: () => output }
}

function request (port, resource, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: resource, method }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

test('builds multiple nested inputs with short flags and a custom extension', t => {
  const dir = fixture(t)
  write(dir, 'input/one.mjml', template('First &amp; second'))
  write(dir, 'input/nested/two.mjml', template('Nested message'))
  success(run(dir, ['build', '-i=input/**/*.mjml', '-o=output', '--extension=.htm']))
  assert.deepEqual(fs.readdirSync(path.join(dir, 'output')).sort(), ['one.htm', 'two.htm'])
  const html = fs.readFileSync(path.join(dir, 'output/one.htm'), 'utf8')
  assert.match(html, /First &amp; second/)
  assert.match(html, /https:\/\/example\.invalid\//)
  assert.match(html, /\[if mso/)
})

test('accepts the long input and output flags', t => {
  const dir = fixture(t)
  write(dir, 'input/one.mjml', template('Long options'))
  success(run(dir, ['build', '--input=input/*.mjml', '--output=output']))
  assert.match(fs.readFileSync(path.join(dir, 'output/one.html'), 'utf8'), /Long options/)
})

test('minifies with the maintained minifier without invoking the legacy engine', t => {
  const dir = fixture(t)
  write(dir, 'input/one.mjml', template('Keep <strong>important</strong> text'))
  success(run(dir, ['build', '-i=input/*.mjml', '-o=pretty', '--beautify']))
  success(run(dir, ['build', '-i=input/*.mjml', '-o=small', '--beautify', '--minify'], { BLOCK_LEGACY_MINIFIER: '1' }))
  const pretty = fs.readFileSync(path.join(dir, 'pretty/one.html'), 'utf8')
  const small = fs.readFileSync(path.join(dir, 'small/one.html'), 'utf8')
  assert.ok(small.length < pretty.length)
  assert.match(small, /Keep <strong>important<\/strong> text/)
  assert.match(small, /<!-- keep me -->/)
  assert.match(small, /\[if mso/)
  assert.match(small, /https:\/\/example\.invalid\//)
  assert.doesNotMatch(small, /\[object Promise\]/)
  success(run(dir, ['build', '-i=input/*.mjml', '-o=no-comments', '--minify', '--no-keepComments']))
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'no-comments/one.html'), 'utf8'), /keep me/)
})

test('minified output matches the previous MJML minification settings on trusted fixtures', async t => {
  const dir = fixture(t)
  const mjml = require('mjml')
  // The legacy dependency is used only as a reference with these fixed, trusted
  // fixtures. Production rendering must never call it (covered above).
  const legacyMinify = require('html-minifier').minify
  const samples = [
    template('Keep <strong>important</strong> text &amp; entities'),
    '<mjml><mj-body><mj-section><mj-column><mj-image src="https://example.invalid/image.png" alt="Image" /><mj-divider /><mj-social><mj-social-element name="facebook" href="https://example.invalid/">Social</mj-social-element></mj-social><mj-raw><!-- conditional fixture --><p style="color: red">Raw HTML</p></mj-raw></mj-column></mj-section></mj-body></mjml>'
  ]
  for (const [index, contents] of samples.entries()) {
    write(dir, `input/${index}.mjml`, contents)
    const rendered = mjml(contents, { beautify: true, minify: false }).html
    const expected = legacyMinify(rendered, {
      collapseWhitespace: true,
      minifyCSS: false,
      caseSensitive: true,
      removeEmptyAttributes: true
    })
    success(run(dir, ['build', `-i=input/${index}.mjml`, '-o=output', '--beautify', '--minify']))
    assert.equal(fs.readFileSync(path.join(dir, `output/${index}.html`), 'utf8'), expected)
  }
})

test('warns for invalid MJML while soft validation still writes HTML', t => {
  const dir = fixture(t)
  write(dir, 'input.mjml', '<mjml><mj-body><mj-section><mj-text>Invalid nesting</mj-text></mj-section></mj-body></mjml>')
  const result = run(dir, ['build', '-i=input.mjml', '-o=output'])
  success(result)
  assert.match(result.stderr, /mj-text/)
  assert.ok(fs.existsSync(path.join(dir, 'output/input.html')))
})

test('an unmatched input and no command remain no-ops', t => {
  const dir = fixture(t)
  success(run(dir, ['build', '-i=missing/*.mjml', '-o=output']))
  success(run(dir, []))
  assert.equal(fs.existsSync(path.join(dir, 'output')), false)
})

test('build reports a missing required path without creating files', t => {
  const dir = fixture(t)
  const result = run(dir, ['build'])
  assert.notEqual(result.status, 0)
  assert.deepEqual(fs.readdirSync(dir), [])
})

test('invalid preview ports fail before acquiring a watcher or socket', t => {
  const dir = fixture(t)
  write(dir, 'input/one.mjml', template('Initial'))
  for (const port of ['-1', '65536', 'preview.sock']) {
    const result = run(dir, ['watch', '-i=input', '-o=output', '--serve', `--port=${port}`])
    assert.equal(result.error, undefined, 'invalid ports must exit rather than hang')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /--port must be an integer/)
    assert.doesNotMatch(result.stdout, /Watching for changes/)
  }
  assert.equal(fs.existsSync(path.join(dir, 'preview.sock')), false)
})

test('watches a nested glob, minifies changes, and keeps the latest edit', async t => {
  const dir = fixture(t)
  write(dir, 'input/nested/one.mjml', template('Initial'))
  write(dir, 'input/note.txt', 'Ignore me')
  const process = start(t, dir, ['watch', '--input=input/**/*.mjml', '--output=output', '--minify'], { BLOCK_LEGACY_MINIFIER: '1' })
  await until(() => process.output().includes('Watching for changes'), 'watcher readiness')
  assert.equal(fs.existsSync(path.join(dir, 'output')), false, 'watch does not introduce an initial build')
  write(dir, 'input/nested/one.mjml', template('Changed once'))
  const target = path.join(dir, 'output/one.html')
  await until(() => fs.existsSync(target) && fs.readFileSync(target, 'utf8').includes('Changed once'), 'first rebuild')
  write(dir, 'input/nested/one.mjml', template('Latest edit'))
  await until(() => fs.readFileSync(target, 'utf8').includes('Latest edit'), 'second rebuild')
  write(dir, 'input/note.txt', 'Still ignored')
  assert.deepEqual(fs.readdirSync(path.join(dir, 'output')), ['one.html'])
  assert.doesNotMatch(process.output(), /legacy minifier|\[object Promise\]/)
})

test('preview serves GET/HEAD and rejects missing, hidden, malformed and traversal paths', async t => {
  const dir = fixture(t)
  write(dir, 'input/one.mjml', template('Preview'))
  write(dir, 'output/index.html', '<h1>Preview home</h1>')
  write(dir, 'output/.secret', 'hidden secret')
  write(dir, 'outside.txt', 'outside secret')
  const process = start(t, dir, ['watch', '-i=input', '--output=output', '--serve', '--port=0'])
  await until(() => /http:\/\/localhost:\d+/.test(process.output()), 'preview listener')
  const port = Number(process.output().match(/http:\/\/localhost:(\d+)/)[1])
  assert.ok(port > 0, 'port 0 must report the assigned port')
  const page = await request(port, '/')
  assert.equal(page.status, 200)
  assert.equal(page.body, '<h1>Preview home</h1>')
  const head = await request(port, '/', 'HEAD')
  assert.equal(head.status, 200)
  assert.equal(head.body, '')
  assert.equal(head.headers['content-length'], page.headers['content-length'])
  for (const url of ['/missing', '/.secret', '/../outside.txt', '/%2e%2e/outside.txt', '/%00', '/%FF']) {
    const result = await request(port, url)
    assert.ok(result.status >= 400, `${url}: ${result.status}`)
    assert.doesNotMatch(result.body, /hidden secret|outside secret|node_modules|SendStream|URIError|BadRequestError/)
  }
})

test('preview shutdown closes clients with unfinished HTTP requests', async t => {
  const dir = fixture(t)
  write(dir, 'input/one.mjml', template('Preview'))
  write(dir, 'output/index.html', 'Preview')
  const process = start(t, dir, ['watch', '-i=input', '-o=output', '--serve', '--port=0'])
  await until(() => /http:\/\/localhost:\d+/.test(process.output()), 'preview listener')
  const port = Number(process.output().match(/http:\/\/localhost:(\d+)/)[1])
  const socket = net.createConnection({ host: '127.0.0.1', port })
  t.after(() => socket.destroy())
  socket.on('error', () => {})
  await once(socket, 'connect')
  socket.write('GET / HTTP/1.1\r\nHost: localhost\r\n')
  const exited = once(process.child, 'exit')
  process.child.kill('SIGTERM')
  await until(() => process.child.exitCode !== null, 'preview shutdown with a partial request')
  assert.deepEqual(await exited, [0, null])
  await until(() => socket.destroyed, 'partial client disconnect')
})
