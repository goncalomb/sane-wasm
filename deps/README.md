# Dependencies

- [backends](backends): SANE API (backends)
- [libjpeg-turbo](libjpeg-turbo): libjpeg required for some SANE backends
- [libusb](libusb): libusb with emscripten support, core SANE dependency

## Patches

Some dependencies receive patches to make them compatible with the build environment or to fix other related issues. Extra features can also be added. Fixes and features not related to wasm and emscripten should be pushed upstream.

Patches are created/updated using git, e.g.:

    cd deps
    git -C backends diff >backends.patch
    git -C libusb diff >libusb.patch

Be careful testing new patches because `./build.sh --clean` will clean all the dependencies. You may lose work that was not saved to a patch.

### SANE API (backends.patch)

- (HACK) force enable pthreads, during configuration pthreads support is not detected
  - `backends/acinclude.m4`
- (FIX) memory violation after freeing the device list, prevented the backends from being reinitialized
  - `backends/backend/canon630u.c`
  - `backends/backend/canon_lide70.c`
  - `backends/backend/epson.c`
  - `backends/backend/epson2.c`
  - `backends/backend/epsonds.c`
  - `backends/backend/hp3500.c`
  - `backends/backend/lexmark.c`
  - `backends/backend/ricoh2.c`
- (FIX) memory violation when `number_of_devices` in set to 0 on the test backend
  - `backends/backend/test.c`
- (FIX) not handling `bytes_read < 0` correctly on the test backend
  - `backends/backend/test.c`
- (FEATURE) adds `SANE_DEBUG_GLOBAL` environment variable to set debug level across all backends
  - `sanei/sanei_init_debug.c`

### libusb (libusb.patch)

- (FIX) cancel function not signaling transfer completion
  - `libusb/libusb/os/emscripten_webusb.cpp`
