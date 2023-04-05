# Dependencies

## Patches

### SANE (backends.patch)

* `backends/acinclude.m4`:
    * force enable pthreads (this must be fixed by addressing the underlying issues)
* `backends/backend/pixma/pixma_common.c`:
    * disable `pixma_sleep` due to ongoing issues with pthreads

### libusb (libusb.patch)

* `libusb/libusb/os/events_posix.c`:
    * fix issue with event timeouts
* `libusb/libusb/os/emscripten_webusb.cpp`:
    * fix close function not waiting for WebUSB promise
    * fix cancel function not signaling transfer completion
    * implement rudimentary support for multi-threading by proxying critical calls back to the main thread (this should be improved)
