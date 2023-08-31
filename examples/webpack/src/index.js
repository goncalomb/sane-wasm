const { libsane } = require('sane-wasm');

class TextBox {
    constructor() {
        this.el = document.body.appendChild(document.createElement('pre'));
        Object.assign(this.el.style, {
            margin: '0 auto',
            maxWidth: '750px',
            whiteSpace: 'pre-wrap',
        });
    }
    clear() {
        this.el.textContent = '';
    }
    append(value) {
        this.el.textContent += JSON.stringify(value, null, 2) + '\n';
    }
}

const tb = new TextBox();
tb.append('Loading...');

libsane({
    sane: {
        debugFunctionCalls: true,
        debugTestDevices: 1,
    },
}).then(async lib => {
    tb.append({
        'SANE_WASM_COMMIT': lib.SANE_WASM_COMMIT,
        'SANE_WASM_VERSION': lib.SANE_WASM_VERSION,
        'SANE_WASM_BACKENDS': lib.SANE_WASM_BACKENDS,
        'SANE_CURRENT_MAJOR': lib.SANE_CURRENT_MAJOR,
        'SANE_CURRENT_MINOR': lib.SANE_CURRENT_MINOR,
    });
    tb.append('sane_init()');
    tb.append(lib.sane_init());
    tb.append('sane_get_state()');
    tb.append(lib.sane_get_state());
    tb.append('sane_get_devices()');
    tb.append(await lib.sane_get_devices());
});
