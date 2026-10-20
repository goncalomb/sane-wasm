# SANE WebAssembly (sane-wasm)

A project to bring the [SANE API](http://www.sane-project.org/intro.html) to Node.js and the Web using WebAssembly.

It supports USB scanners on browser environments through the [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) and on Node.js using [node-usb](https://github.com/node-usb/node-usb).

This works by compiling all SANE backends (and required dependencies) to WebAssembly using Emscripten. The other key piece is @RReverser's bridge from libusb to WebUSB ([article](https://web.dev/articles/porting-libusb-to-webusb)/[article](https://web.dev/articles/porting-gphoto2-to-the-web)/[code](https://github.com/libusb/libusb/pull/1057)/[code](https://github.com/libusb/libusb/pull/1339)) for direct USB access.

Right now, it includes [all backends](http://www.sane-project.org/lists/sane-backends-cvs.html) that have support for at least one USB device. No [external backends](http://www.sane-project.org/lists/sane-backends-external.html) are included at the moment.

## WebScan

**Check [webscan.goncalomb.com](https://webscan.goncalomb.com/) ([source](https://github.com/goncalomb/webscan)) for a demo of sane-wasm.** This is a React application that uses sane-wasm for document/image scanning directly in the browser. It exposes all scanning options for full control.

## Usage

The pre-compiled WebAssembly package for sane-wasm is published on NPM:

<https://www.npmjs.com/package/sane-wasm>

### For Web environments (e.g. Webpack, Vite, etc.)

```bash
npm install sane-wasm
```

Cross-origin isolation ([COOP+COEP](https://web.dev/articles/coop-coep)) is required for [multithreading](https://emscripten.org/docs/porting/pthreads.html) which uses Web Workers and SharedArrayBuffer. This is not optional.

See [examples/webpack/](https://github.com/goncalomb/sane-wasm/tree/master/examples/webpack) for a working example.

### For Node.js

```bash
npm install sane-wasm usb
```

The usb package ([node-usb](https://github.com/node-usb/node-usb)) is required to provide USB functionality.

See [examples/node/](https://github.com/goncalomb/sane-wasm/tree/master/examples/node) for a working example.

## Building

A pre-configured Docker image is used for building and debugging. Most `npm run ...` commands use Docker.

### Build SANE and test page

```bash
git clone https://github.com/goncalomb/sane-wasm.git
cd sane-wasm
npm run debug
```

Check the test page at: <http://localhost:6931/libsane.html>.

### Other commands

```bash
npm run clean  # clean build artifacts and dependencies
npm run build  # run full clean build (SANE + TypeScript)
npm run debug  # run debug build (SANE only) and start the test server
npm run emrun  # start the test server
npm run test   # run the tests
```

### Non-Docker builds and `build.sh`

Building without Docker is possible but untested. It requires [Emscripten](https://emscripten.org/) and all the tools to build the dependencies, see [Dockerfile](https://github.com/goncalomb/sane-wasm/blob/master/Dockerfile).

The `./build.sh` script controls the build and has other options for debugging:

```text
usage: build.sh [options]
  --with-docker  run with docker (preferred)
  --clean        clean 'deps' and 'build' directories
  --no-build     don't actually build
  --debug        enable debug flags
  --emrun        run emrun development server
  --shell        run debug shell (depends on --with-docker)
```

## API

API documentation is available at: [https://goncalomb.github.io/sane-wasm/](https://goncalomb.github.io/sane-wasm/modules.html).

Most of the SANE API is exposed as-is, check the [SANE Standard](https://sane-project.gitlab.io/standard/index.html).

Some safeguards are in place to avoid API misuse and prevent memory leaks. It's important to understand the SANE API and follow the [Code Flow](https://sane-project.gitlab.io/standard/api.html#code-flow) to avoid issues.

### Differences with the SANE API

The most important difference with the underlying SANE API is that **device handles are not exposed**. This means that `sane_open()` does not return a device handle. A single handle is managed by the internal code. This effectively means that **only one device can be accessed at a time**. This was a design decision made to simplify the API and prevent other issues.

Other differences include:

- function arguments and return values are adapted for javascript (see docs)
- extra sane-wasm constants: `SANE_WASM_COMMIT`, `SANE_WASM_VERSION`, and `SANE_WASM_BACKENDS`
- values of type `SANE_Fixed` are automatically converted to/from `Number`
- extra `sane_get_state()` function exclusive to sane-wasm
- `sane_control_option()` is split into 3 separate functions:
  - `sane_control_option_get_value()`
  - `sane_control_option_set_value()`
  - `sane_control_option_set_auto()`
- `sane_set_io_mode()` is not available on sane-wasm
- `sane_get_select_fd()` is no available on sane-wasm

### Extra TypeScript classes (utilities)

- [src/options.ts](https://github.com/goncalomb/sane-wasm/blob/master/src/options.ts) to manage scanner options
- [src/readers.ts](https://github.com/goncalomb/sane-wasm/blob/master/src/readers.ts) for image acquisition and decoding

## License

Because of the weird state of SANE's licensing (GPL + linking exception, on some backends), see [backends/LICENSE](https://gitlab.com/sane-project/backends/-/blob/master/LICENSE). I'm releasing this project with dual licensing [GNU GPLv2](https://github.com/goncalomb/sane-wasm/blob/master/LICENSE.txt) + [GNU LGPLv2.1](https://github.com/goncalomb/sane-wasm/blob/master/LICENSE-LGPL.txt). IANAL, you choose.
