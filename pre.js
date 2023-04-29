/*
    SANE WebAssembly (sane-wasm)

    Copyright (C) 2023 Gonçalo MB <me@goncalomb.com>

    GNU GPLv2

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

    GNU LGPLv2.1

    This library is free software; you can redistribute it and/or
    modify it under the terms of the GNU Lesser General Public
    License as published by the Free Software Foundation; either
    version 2.1 of the License, or (at your option) any later version.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
    Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public
    License along with this library; if not, write to the Free Software
    Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301
    USA
*/

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

    // Many SANE functions are expected to return a promise, even though
    // they originally are blocking calls. This happens because we use
    // emscripten's asyncify feature.
    // https://emscripten.org/docs/porting/asyncify.html
    // So calls that would block (because they call sleep, access libusb, wait
    // for web apis, etc.) just return a promise.
    // A call only returns a promise if it falls in one of those cases that
    // triggers asyncify.
    // To normalize the API, we wrap SANE functions that have change to be
    // async in a promise (to make sure they always return a promise).
    // We call that promisify.
    // Because of the complex code path of all SANE backends, and the use of
    // indirect calls, it's not known if all SANE functions need to be wrapped.
    // XXX: If any new functions are found to possibly return a promise,
    //      add them to the list. THIS WILL CAUSE THE PUBLIC API TO CHANGE.

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
        debugTestDevices: 0,
        promisify: true,
        promisifyQueue: true,
        ...(Module.sane || {})
    };

    Module.preRun = Module.preRun || [];
    Module.postRun = Module.postRun || [];

    Module.preRun.push(() => {
        ENV.SANE_CONFIG_DIR = "/etc/sane.d";
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

    // We don't really use the main() function for any library calls,
    // so using preRun or postRun here is almost identical.
    // The library just starts working when we call sane_init externally.

    Module.postRun.push(() => {
        // promote enums to more useful objects
        ["SANE_STATUS", "SANE_TYPE", "SANE_UNIT", "SANE_CONSTRAINT", "SANE_FRAME"].forEach(s => {
            EnumSANE.promote(Module[s]);
        });

        // set test backend number of devices
        if (Module.sane.debugTestDevices) {
            let buf = Module.FS.readFile("/etc/sane.d/test.conf");
            let match = false;
            const arr = (new TextDecoder()).decode(buf).split("\n").map(l => {
                if (l.match(/^\s*number_of_devices\s+.*$/)) {
                    match = true;
                    return `number_of_devices ${Module.sane.debugTestDevices}`;
                }
                return l;
            });
            if (!match) {
                arr.push(`number_of_devices ${Module.sane.debugTestDevices}`, "");
            }
            buf = (new TextEncoder()).encode(arr.join("\n"));
            Module.FS.writeFile("/etc/sane.d/test.conf", buf);
        }

        // enable debug for sane function calls
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

        // wrap sane functions with promises to normalize api
        if (Module.sane.promisify) {
            const wrap = (fn) => (...args) => {
                const res = fn(...args);
                return res instanceof Promise ? res : Promise.resolve(res);
            };
            Object.keys(libFunctionsAsync).filter(name => libFunctionsAsync[name]).forEach(name => {
                Module[name] = wrap(Module[name]);
            });
        }

        // wrap sane functions using promise queue to prevent further calls
        // while other async functions are still running (not supported)
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
