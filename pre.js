{
    Module.sane = {
        debugSANE: false,
        debugUSB: false,
        ...(Module.sane || {})
    };
    Module.preRun = Module.preRun || [];
    Module.preRun.push(() => {
        if (Module.sane.debugSANE) {
            // see ./deps/backends/sanei/sanei_init_debug.c
            // each sane backend uses different numbers for different verbosity levels
            // we might need to specify each one individually (using 9 for now)
            // SANE_DEBUG_GLOBAL is not standard, it's added with a patch
            // there are some very verbose levels that should not be used here
            ENV.SANE_DEBUG_GLOBAL = "9";
        }
        if (Module.sane.debugUSB) {
            // see ./deps/libusb/libusb/core.c
            // LIBUSB_LOG_LEVEL_DEBUG = 4
            ENV.LIBUSB_DEBUG = "4";
        }
    });
}
