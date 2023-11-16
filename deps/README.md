# Dependencies

* [backends](backends): SANE API (backends)
* [libjpeg-turbo](libjpeg-turbo): libjpeg required for some SANE backends
* [libusb](libusb): libusb with emscripten support, core SANE dependency

## Patches

Some dependencies receive patches to make them compatible with the build environment or to fix other related issues. Extra features can also be added. Fixes and features not related to wasm and emscripten should be pushed upstream.

Patches are created/updated using git, e.g.:

    cd deps
    git -C backends diff >backends.patch
    git -C libusb diff >libusb.patch

Be careful testing new patches because `./build.sh --clean` will clean all the dependencies. You may lose work that was not saved to a patch.

### SANE API (backends.patch)

* `backends/acinclude.m4`:
    * (HACK) force enable pthreads, during compile configuration pthreads support is not detected, the underlying issue should be eventually addressed, forcing it works for now
* `backends/backend/canon630u.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/canon_lide70.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/epson.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/epson2.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/epsonds.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/hp3500.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/lexmark.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `backends/backend/ricoh2.c`:
    * (FIX) fix memory violation after freeing the device list, prevented the backend from being reinitialized
* `sanei/sanei_init_debug.c`:
    * (FEATURE) implement `SANE_DEBUG_GLOBAL` environment variable to set debug level across all backends

### libusb (libusb.patch)
