#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const http = require('http')

const glob = require('fast-glob')
const chokidar = require('chokidar')
const fse = require('fs-extra')
const mjml = require('mjml')
const { minify: minifyHtml } = require('html-minifier-terser')
const serveStatic = require('serve-static')
const finalhandler = require('finalhandler')
const args = require('get-them-args')()

async function main () {
  if (!args.unknown.includes('build') && !args.unknown.includes('watch')) return

  const inputArg = args.i || args.input
  const outputArg = args.o || args.output
  if (typeof inputArg !== 'string' || typeof outputArg !== 'string') {
    throw new Error('Provide an input (-i or --input) and output (-o or --output) path.')
  }
  const input = path.join(process.cwd(), inputArg)
  const output = path.join(process.cwd(), outputArg)
  const { fonts, keepComments, beautify, minify, validationLevel, filePath, mjmlConfigPath, extension = '.html', serve = false, port = 8989 } = args

  async function render (file) {
    const name = path.basename(file)
    const outputFile = path.join(output, name.replace('.mjml', extension))
    const contents = fs.readFileSync(file, 'utf8')
    // MJML 4's synchronous minifier is deprecated and has an unfixed advisory.
    // Keep its renderer, but explicitly disable that path and await its successor.
    const result = mjml(contents, { fonts, keepComments, beautify, minify: false, validationLevel, filePath, mjmlConfigPath })
    result.errors.forEach(error => console.warn(error))
    const html = minify
      ? await minifyHtml(result.html, {
        collapseWhitespace: true,
        minifyCSS: false,
        caseSensitive: true,
        removeEmptyAttributes: true
      })
      : result.html
    fse.outputFileSync(outputFile, html)
    return outputFile
  }

  if (args.unknown.includes('build')) {
    for (const file of glob.sync(input)) {
      console.log(`Writing file: ${await render(file)}`)
    }
  }

  if (!args.unknown.includes('watch')) return

  if (serve && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error('The preview --port must be an integer from 0 to 65535.')
  }

  const watcher = chokidar.watch(input, {
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 }
  })
  let server
  const connections = new Set()
  let pending = Promise.resolve()
  let stopping = false

  async function shutdown () {
    if (stopping) return
    stopping = true
    await watcher.close()
    if (server && server.listening) {
      const closed = new Promise(resolve => server.close(resolve))
      // A partial HTTP request must not keep a stopped preview process alive.
      for (const socket of connections) socket.destroy()
      await closed
    }
    await pending
  }

  watcher.on('ready', () => {
    console.log(`Watching for changes in: ${input}`)
  })

  watcher.on('error', error => {
    console.error(error)
  })

  watcher.on('change', file => {
    console.log(`Change detected in: ${file}`)
    if (path.extname(file) !== '.mjml') return
    // The replacement minifier is asynchronous. Serialize rebuilds so an older
    // render cannot overwrite the result of a later change.
    pending = pending.then(async () => {
      if (stopping) return
      await render(file)
      console.log(`Updated: ${file}`)
    }).catch(error => console.error(error))
  })

  if (serve) {
    const preview = serveStatic(output, { index: ['index.html', 'index.htm'], dotfiles: 'ignore' })
    server = http.createServer((req, res) => {
      preview(req, res, finalhandler(req, res, { env: 'production' }))
    })
    server.on('connection', socket => {
      connections.add(socket)
      socket.on('close', () => connections.delete(socket))
    })
    server.on('error', error => {
      console.error(error)
      process.exitCode = 1
      shutdown().catch(error => console.error(error))
    })
    server.listen(port, () => {
      console.log(`${outputArg} on http://localhost:${server.address().port}`)
    })
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      shutdown().catch(error => {
        console.error(error)
        process.exitCode = 1
      })
    })
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
