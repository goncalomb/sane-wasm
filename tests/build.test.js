// const { webusb } = require('usb');
const { libsane } = require('..');
const { execSync } = require('child_process');

const lib = libsane();

test('version', async () => {
    const l = await lib;
    // test commit hash
    expect(l.SANE_WASM_COMMIT).toBe(execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim());
    // test version, expect clean builds, don't include '--dirty'
    expect(l.SANE_WASM_VERSION).toBe(execSync('git describe --tags --always', { encoding: 'utf8' }).trim());
    // test 'package.json' version
    expect(l.SANE_WASM_VERSION.split('-')[0]).toStartWith(`v${require('../package.json').version}`);
});

test('46 backends', async () => {
    const l = await lib;
    expect(l.SANE_WASM_BACKENDS.split(' ')).toBeArrayOfSize(46);
});

test('sane version 1.0', async () => {
    const l = await lib;
    expect(l.SANE_CURRENT_MAJOR).toBe(1);
    expect(l.SANE_CURRENT_MINOR).toBe(0);
});
