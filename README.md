
# mjml-scripts
[![package version](https://img.shields.io/npm/v/mjml-scripts.svg?style=flat-square)](https://npmjs.org/package/mjml-scripts)
[![package downloads](https://img.shields.io/npm/dm/mjml-scripts.svg?style=flat-square)](https://npmjs.org/package/mjml-scripts)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/mjml-scripts.svg?style=flat-square)](https://npmjs.org/package/mjml-scripts)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

> CLI scripts for making work with [MJML](https://mjml.io/) a little bit nicer

## Table of Contents

- [Usage](#usage)
- [Install](#install)
- [Contribute](#contribute)
- [License](#License)

## Usage

### Build

```sh
$ mjml-scripts build -i=example/**.mjml -o=dist --minify --beautify
```

```sh
$ mjml-scripts build -i=example/**.mjml -o=dist -extension=".htm"
```

See [MJML documentation](https://mjml.io/documentation/#inside-node-js) for additional configuration options.

`--input` and `--output` are aliases for `-i` and `-o`. Quote glob patterns
to prevent your shell from expanding them. Nested inputs are written into the
output directory using their basenames, so use distinct filenames.

Minification uses `html-minifier-terser` after MJML rendering and optional
beautification. It preserves MJML's whitespace, case-sensitive markup and
empty-attribute minification settings. Use `--no-keepComments` to remove source
comments. Outlook conditional comments are preserved.

### Watch

```sh
$ mjml-scripts watch -i=example -o=dist
```

```sh
$ mjml-scripts watch -i=example -o=dist --serve --port=4444
```

Watch accepts directories or quoted globs (including `**/*.mjml`). As before,
it rebuilds changed MJML files; run `build` first for the initial output.
Writes settle for 100 ms before rendering, and rebuilds are serialized.
Stop the watcher and optional server with Ctrl-C.

The optional preview server uses maintained `serve-static` and `finalhandler`
directly, rather than depending on an unpublished update to `dien`. It hides
dotfiles and error stacks. It is a development preview, not a security sandbox:
only serve trusted output directories, and remember that symlinks can expose
files outside them. The listener retains the existing all-interface behavior.

## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com).

Node.js 18 or newer is required by this refresh. Use a currently supported Node
release for normal use. The CLI remains CommonJS, and Chokidar stays on version
3 to preserve glob watching.

```sh
$ npm install -g mjml-scripts
$ # OR
$ yarn global add mjml-scripts
```

## Contribute

Install the locked dependencies with `npm ci --ignore-scripts`, then run
`npm run check` for non-fixing lint and child-process CLI tests. `npm run lint:fix`
is available separately. Tests cover build options, actual filesystem watching,
minification and a loopback HTTP preview; fixtures do not fetch remote resources.

### Dependency security limits

This compatible MJML 4 refresh does **not** produce a clean security audit.
Only render trusted templates and use trusted input patterns:

- MJML 4 still installs `html-minifier` 4, affected by
  [GHSA-pfq8-rq6v-vf5m](https://github.com/advisories/GHSA-pfq8-rq6v-vf5m).
  This CLI explicitly disables MJML's deprecated minification path and uses
  `html-minifier-terser` instead. The vulnerable package remains in the graph;
  using MJML's own minification API directly is not covered by this mitigation
- MJML 4 is affected by include-path traversal
  [GHSA-45h5-66jx-r2wf](https://github.com/advisories/GHSA-45h5-66jx-r2wf).
  The upstream fix requires MJML 5; this refresh preserves MJML 4 compatibility
- Glob dependencies include `braces` 3.0.3, affected by deeply nested pattern
  denial of service [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  No patched version was available when this refresh was prepared

Run both `npm audit` and `npm audit --omit=dev` when updating the lock. Do not
override MJML's synchronous minifier with an asynchronous package: that changes
its API and does not make the underlying renderer compatible.

1. Fork it and create your feature branch: `git checkout -b my-new-feature`
2. Commit your changes: `git commit -am "Add some feature"`
3. Push to the branch: `git push origin my-new-feature`
4. Submit a pull request

## License

MIT
