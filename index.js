#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const glob = require('fast-glob')
const chokidar = require('chokidar')
const fse = require('fs-extra')
const mjml = require('mjml')
const dien = require('dien')
const args = require('get-them-args')()

if (args.unknown.includes('build')) {
  const input = path.join(process.cwd(), args.i || args.input)
  const output = path.join(process.cwd(), args.o || args.o)
  const { fonts, keepComments, beautify, minify, validationLevel, filePath, mjmlConfigPath, extension = '.html' } = args

  const files = glob.sync(input)

  files.forEach(file => {
    const name = path.basename(file)
    const outputFile = path.join(output, name.replace('.mjml', extension))
    const contents = fs.readFileSync(file, 'utf8')
    const { html, errors } = mjml(contents, { fonts, keepComments, beautify, minify, validationLevel, filePath, mjmlConfigPath })

    if (errors.length) {
      errors.forEach(error => console.warn(error))
    }

    console.log(`Writing file: ${outputFile}`)
    fse.outputFileSync(outputFile, html)
  })
}outputFile

if (args.unknown.includes('watch')) {
  const input = path.join(process.cwd(), args.i || args.input)
  const output = path.join(process.cwd(), args.o || args.o)
  const { fonts, keepComments, beautify, minify, validationLevel, filePath, mjmlConfigPath, extension = '.html', serve = false, port = 8989 } = args

  const watcher = chokidar.watch(input, { persistent: true })

  watcher.on('ready', () => {
    console.log(`Watching for changes in: ${input}`)
  })

  watcher.on('error', (error) => {
    console.error(error)
  })

  watcher.on('change', (file) => {
    console.log(`Change detected in: ${file}`)
    if (path.extname(file) === '.mjml') {
      // TODO: Refactor out duplicate code
      const name = path.basename(file)
      const outputFile = path.join(output, name.replace('.mjml', extension))
      const contents = fs.readFileSync(file, 'utf8')
      const { html, errors } = mjml(contents, { fonts, keepComments, beautify, minify, validationLevel, filePath, mjmlConfigPath })

      if (errors.length) {
        errors.forEach(error => console.warn(error))
      }

      fse.outputFileSync(outputFile, html)
      console.log(`Updated: ${file}`)
    }
  })

  if (serve) {
    dien(args.o || args.o, port)
  }

  process.on('exit', () => {
    watcher.close()
  })
}
