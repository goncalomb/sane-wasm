{
    class EnumSANE {
        // static reverseObject = Symbol("reverseObject"); // not supported

        static promote(obj) {
            obj.__proto__ = this.prototype;
            obj[this.reverseObject] = {};
            Object.keys(obj).forEach(k => {
                obj[this.reverseObject][obj[k]] = k;
            });
        }

        asString(i) {
            return this[this.constructor.reverseObject][i] || null;
        }
    }
    EnumSANE.reverseObject = Symbol("reverseObject");

    const libFunctionsAsync = { // true = promise return is expected
        sane_get_state: false, // sync, implemented in glue.cpp
        sane_init: false, // sync?
        sane_exit: true, // async, exiting when device is open
        sane_get_devices: true, // async
        sane_open: true, // async
        sane_close: true, // async
        sane_get_option_descriptor: false, // sync
        sane_control_option_get_value: true, // some options are async
        sane_control_option_set_value: true, // some options are async
        sane_control_option_set_auto: false, // suspected of possibly being async
        sane_get_parameters: false, // sync?
        sane_start: false, // sync?
        sane_read: true, // async, waits for scan completion
        sane_cancel: true, // async, waits for scan completion
        sane_strstatus: false, // sync
    }

    Module.sane = {
        debugSANE: false,
        debugUSB: false,
        debugFunctionCalls: false,
        promisify: true,
        promisifyQueue: true,
        ...(Module.sane || {})
    };

    Module.preRun = Module.preRun || [];
    Module.postRun = Module.postRun || [];

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

    Module.postRun.push(() => {
        ["SANE_STATUS", "SANE_TYPE", "SANE_UNIT", "SANE_CONSTRAINT", "SANE_FRAME"].forEach(s => {
            EnumSANE.promote(Module[s]);
        });

        if (Module.sane.debugFunctionCalls) {
            const wrap = (fn) => (...args) => {
                const res = fn(...args);
                console.info(`LibSANE.${fn.name}`, args, res);
                if (libFunctionsAsync[fn.name] === false && res instanceof Promise) {
                    console.warn(`LibSANE.${fn.name} returned promise unexpectedly`);
                }
                return res;
            };
            Object.keys(libFunctionsAsync).forEach(name => {
                Module[name] = wrap(Module[name]);
            });
        }

        if (Module.sane.promisify) {
            const wrap = (fn) => (...args) => {
                const res = fn(...args);
                return res instanceof Promise ? res : Promise.resolve(res);
            };
            Object.keys(libFunctionsAsync).filter(name => libFunctionsAsync[name]).forEach(name => {
                Module[name] = wrap(Module[name]);
            });
        }

        if (Module.sane.promisify && Module.sane.promisifyQueue) {
            const queue = [];
            let busy = false;
            const dequeue = () => {
                if (queue.length) {
                    queue.shift()();
                } else {
                    busy = false;
                }
            }
            const enqueue = (fn) => {
                return new Promise((resolve, reject) => {
                    queue.push(() => fn().then(resolve, reject).finally(dequeue));
                });
            }
            const wrap = (fn) => (...args) => {
                if (busy) {
                    return enqueue(() => fn(...args));
                }
                busy = true;
                return fn(...args).finally(dequeue);
            };
            const wrapSync = (fn) => (...args) => {
                if (busy) {
                    throw new Error("There is an async operation in progress");
                }
                return fn(...args);
            };
            Object.keys(libFunctionsAsync).forEach(name => {
                Module[name] = (libFunctionsAsync[name] ? wrap : wrapSync)(Module[name]);
            });
        }
    });
}
