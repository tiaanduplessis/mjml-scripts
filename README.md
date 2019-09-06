
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

### Watch

```sh
$ mjml-scripts watch -i=example -o=dist
```

```sh
$ mjml-scripts watch -i=example -o=dist --serve --port=4444
```

## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com).

```sh
$ npm install -g mjml-scripts
$ # OR
$ yarn global add mjml-scripts
```

## Contribute

1. Fork it and create your feature branch: `git checkout -b my-new-feature`
2. Commit your changes: `git commit -am "Add some feature"`
3. Push to the branch: `git push origin my-new-feature`
4. Submit a pull request

## License

MIT
