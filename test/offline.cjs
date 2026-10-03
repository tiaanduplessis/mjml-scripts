// CLI fixtures may only open loopback connections. Never fetch remote resources.
const http = require('node:http')
const https = require('node:https')
const Module = require('node:module')

for (const transport of [http, https]) {
  for (const method of ['request', 'get']) {
    const original = transport[method]
    transport[method] = function (options, ...rest) {
      const host = typeof options === 'string' ? new URL(options).hostname : options.hostname || options.host
      if (host && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`Remote request blocked: ${host}`)
      return original.call(this, options, ...rest)
    }
  }
}

if (process.env.BLOCK_LEGACY_MINIFIER) {
  const load = Module._load
  Module._load = function (name, ...args) {
    if (name === 'html-minifier') return { minify: () => { throw new Error('legacy minifier must not run') } }
    return load.call(this, name, ...args)
  }
}
