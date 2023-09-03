# SANE WebAssembly (sane-wasm)

A project to bring the [SANE API](http://www.sane-project.org/intro.html) to Node.js and the Web using WebAssembly.

It supports USB scanners on browser environments through the [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) and on Node.js using [node-usb](https://github.com/node-usb/node-usb).

This works by compiling all SANE backends (and required dependencies) to WebAssembly using Emscripten. The other key piece is @RReverser's [bridge from libusb to WebUSB](https://github.com/libusb/libusb/pull/1057) ([1](https://web.dev/porting-libusb-to-webusb/)/[2](https://web.dev/porting-gphoto2-to-the-web/)) with [some patching](https://github.com/goncalomb/sane-wasm/issues/1) to support multi-threading.

Right now, it includes [all backends](http://www.sane-project.org/lists/sane-backends-cvs.html) that have support for at least one USB device ([genesys is not included due to issues](https://github.com/goncalomb/sane-wasm/issues/3)). No [external backends](http://www.sane-project.org/lists/sane-backends-external.html) are included at the moment.

## WebScan

**Check [webscan.goncalomb.com](https://webscan.goncalomb.com/) for a demo of sane-wasm.** This is a React application that uses sane-wasm for document/image scanning directly in the browser. It exposes all scanning options to the user for full control.

## Usage

The pre-compiled WebAssembly package for sane-wasm is published on NPM:

https://www.npmjs.com/package/sane-wasm?activeTab=code

### For Web Environments (e.g. Webpack)

```
npm install -D sane-wasm
```

The main .js will not be bundled with your application. A loader ([lib/loader.js](https://github.com/goncalomb/sane-wasm/blob/master/lib/loader.js)) is provided to automatically load the .js/.wasm files from a CDN ([jsdelivr.com](https://www.jsdelivr.com/)). You can configure the loader to serve the files from your server if you want.

See [examples/webpack/](https://github.com/goncalomb/sane-wasm/tree/master/examples/webpack) for a working example.

### For Node.js

```
npm install sane-wasm usb
```

The usb package ([node-usb](https://github.com/node-usb/node-usb)) is required to provide USB functionality.

See [examples/node/](https://github.com/goncalomb/sane-wasm/tree/master/examples/node) for a working example.

### As Git Submodule (not recommended) / Custom Build

As an alternative, you can add sane-wasm as a [submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) to your application and integrate `./build.sh` with your build process. This is not recommended as it relies on some magical/dubious code on `./build.sh` to make the build work.

You can also just build sane-wasm independently and use the build artifacts...

```
<script src="build/libsane.js"></script>
<script>
    window.LibSANE().then(lib => {
        // your code
        console.log(lib.sane_init());
    });
</script>
```

```
const { libsane } = require('./sane-wasm');
libsane().then(lib => {
    console.log(lib.sane_init());
});
```

```
import { libsane } from './sane-wasm';
const lib = await libsane();
console.log(lib.sane_init());
```

## Building

### SANE Only

Building requires [emscripten](https://github.com/emscripten-core/emscripten) and all the required tools to build the dependencies.

The preferred way is just to use the pre-configured Docker image:

    git clone --recurse-submodules https://github.com/goncalomb/sane-wasm.git
    cd sane-wasm
    ./build.sh --with-docker --clean

Start the test server with:

    ./build.sh --with-docker --no-build --emrun

Check the test page at: http://localhost:6931/libsane.html.

#### build.sh

The `./build.sh` script has other options for debugging:

```
usage: build.sh [options]
  --with-docker  run with docker (preferred)
  --clean        clean 'deps' and 'build' directories
  --no-build     don't actually build
  --debug        enable debug flags
  --emrun        run emrun development server
  --shell        run debug shell (depends on --with-docker)
```

### Full Build (SANE + TypeScript)

To do a full build use `npm run build`.

## API

Most of the SANE API is exposed as-is. Check the [SANE Standard](https://sane-project.gitlab.io/standard/index.html).

Some safeguards are in place to avoid API misuse and prevent memory leaks. It's important to understand the SANE API and follow the [Code Flow](https://sane-project.gitlab.io/standard/api.html#code-flow) to avoid issues.

### Differences with the SANE API

The most important difference with the underlying SANE API is that **device handles are not exposed**. This means that `sane_open()` does not return a device handle. A single handle is managed by the internal code. This effectively means that **only one device can be accessed at a time**. This was a design decision made to simplify the API and prevent other issues.

> Personally, I believe that this is an acceptable change, especially for WebAssembly where it may be easier to lose track of opened resources and crash the application. The SANE API is also somewhat unforgiving and building more safeguards around it (especially with multiple handles) is not worth the effort. Ultimately I don't see a use that requires more than one device open at a time. -goncalomb

### Documentation

Check API documentation at: [goncalomb.github.io/sane-wasm/modules.html](https://goncalomb.github.io/sane-wasm/modules.html).

## License

Because of the weird state of SANE's licensing (GPL + linking exception, on some backends), see [backends/LICENSE](https://gitlab.com/sane-project/backends/-/blob/master/LICENSE). I'm releasing this project with dual licensing [GNU GPLv2](https://github.com/goncalomb/sane-wasm/blob/master/LICENSE.txt) + [GNU LGPLv2.1](https://github.com/goncalomb/sane-wasm/blob/master/LICENSE-LGPL.txt). IANAL, you choose.
