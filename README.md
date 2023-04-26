# SANE WebAssembly (sane-wasm)

A project to bring the [SANE API](http://www.sane-project.org/intro.html) to the web.

Currently, it only supports USB scanners and was only tested on a browser environment (WebUSB).

This works by compiling all SANE backends (and required dependencies) to WebAssembly using Emscripten. The other key piece is @RReverser's [bridge from libusb to WebUSB](https://web.dev/porting-libusb-to-webusb/) ([more](https://web.dev/porting-gphoto2-to-the-web/)), this libusb backend [required some patching](deps/libusb.patch) support multi-threading.

## Building

Building requires [emscripten](https://github.com/emscripten-core/emscripten) and all the required tools to build the dependencies.

The preferred way is just to use the pre-configured Docker image:

    git clone --recurse-submodules https://github.com/goncalomb/sane-wasm.git
    cd sane-wasm
    ./build.sh --with-docker --clean

Start the test server with:

    ./build.sh --with-docker --no-build --emrun

Check the test page at: http://localhost:6931/libsane.html.

### build.sh

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

## Using

For now, this project has only been used on a browser environment, usage with Node.js or other environments is untested/unsupported. The API may still suffer changes and no `npm` package is provided at the moment.

The recommended way to use this project is to add it as a [submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) to your application. Integrate `./build.sh` with your build process. And include the main .js file:

```
<script src="build/libsane.js"></script>
<script>
    window.LibSANE().then(LibSANE => {
        window.LibSANE = LibSANE;
        // your code
        console.log(LibSANE.sane_init());
    });
</script>
```

I don't recommend minifying `libsane.js` with your application code. It may break some things.

This will be improved in the future.

## Exposed API (may not be final)

Most of the SANE API is exposed as-is. Check the [SANE Standard](https://sane-project.gitlab.io/standard/index.html).

Some safeguards are in place to avoid API misuse and prevent memory leaks. It's important to understand the SANE API and follow the [Code Flow](https://sane-project.gitlab.io/standard/api.html#code-flow) to avoid issues.

### Differences with the SANE API

The most important difference with the underlying SANE API is that **device handles are not exposed**. This means that `sane_open()` does not return a device handle. A single handle is managed by the internal code. This effectively means that **only one device can be accessed at a time**. This was a design decision made to simplify the API and prevent other issues.

> Personally, I (@goncalomb) believe that this is an acceptable change, especially for WebAssembly where it may be easier to lose track of opened resources and crash the application. The SANE API is also somewhat unforgiving and building more safeguards around it (especially with multiple handles) is not worth the effort. Ultimately I don't see a use that requires more than one device open at a time.

### Constants

_documentation in progress, the API may still suffer changes_

`LibSANE.SANE_WASM_COMMIT`

`LibSANE.SANE_WASM_VERSION`

`LibSANE.SANE_WASM_BACKENDS`

`LibSANE.SANE_CURRENT_MAJOR` (number) = SANE C macro `SANE_CURRENT_MAJOR`

`LibSANE.SANE_CURRENT_MINOR` (number) = SANE C macro `SANE_CURRENT_MINOR`

`LibSANE.SANE_STATUS` (object) = SANE C enum `SANE_Status`

`LibSANE.SANE_TYPE` (object) = SANE C enum `SANE_Value_Type`

`LibSANE.SANE_UNIT` (object) = SANE C enum `SANE_Unit`

`LibSANE.SANE_CONSTRAINT` (object) = SANE C enum `SANE_Constraint_Type`

`LibSANE.SANE_FRAME` (object) = SANE C enum `SANE_Frame`

### Functions

_documentation in progress, the API may still suffer changes_

`LibSANE.sane_get_state` (extra function, not part of the SANE API)

`LibSANE.sane_init`

`LibSANE.sane_exit`

`LibSANE.sane_get_devices`

`LibSANE.sane_open`

`LibSANE.sane_close`

`LibSANE.sane_get_option_descriptor`

`LibSANE.sane_control_option_get_value`

`LibSANE.sane_control_option_set_value`

`LibSANE.sane_control_option_set_auto`

`LibSANE.sane_get_parameters`

`LibSANE.sane_start`

`LibSANE.sane_read`

`LibSANE.sane_cancel`

`LibSANE.sane_strstatus`
