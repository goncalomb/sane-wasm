import { libsane } from 'sane-wasm';

const lib = await libsane({
    sane: {
        debugTestDevices: 1,
    }
});
console.log({
    'SANE_WASM_COMMIT': lib.SANE_WASM_COMMIT,
    'SANE_WASM_VERSION': lib.SANE_WASM_VERSION,
    'SANE_WASM_BACKENDS': lib.SANE_WASM_BACKENDS,
    'SANE_CURRENT_MAJOR': lib.SANE_CURRENT_MAJOR,
    'SANE_CURRENT_MINOR': lib.SANE_CURRENT_MINOR,
});
console.log('sane_init()');
console.log(lib.sane_init());
console.log('sane_get_state()');
console.log(lib.sane_get_state());
console.log('sane_get_devices()');
console.log(await lib.sane_get_devices());
