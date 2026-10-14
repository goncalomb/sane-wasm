import { execSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { libsane } from '..';
import pkg from '../package.json' with { type: 'json' };

const lib = libsane();

const envFlag = (name) => !/^(?:false|off|0|)$/.test(process.env[name] ?? '');

test('version', async () => {
    const l = await lib;
    // test commit hash
    expect(l.SANE_WASM_COMMIT).toBe(execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim());
    // test version, expect clean builds, don't include '--dirty'
    if (!envFlag('TEST_SKIP_GIT_VERSION')) {
        expect(l.SANE_WASM_VERSION).toBe(execSync('git describe --tags --always', { encoding: 'utf8' }).trim());
    }
    // test 'package.json' version
    if (!envFlag('TEST_SKIP_PKG_VERSION')) {
        // can fail on release commits that are not tagged yet
        expect(l.SANE_WASM_VERSION.split('-')[0]).toBe(`v${pkg.version}`);
    }
});

test('47 backends', async () => {
    const l = await lib;
    expect(l.SANE_WASM_BACKENDS.split(' ')).toBeArrayOfSize(47);
});

test('sane version 1.0', async () => {
    const l = await lib;
    expect(l.SANE_CURRENT_MAJOR).toBe(1);
    expect(l.SANE_CURRENT_MINOR).toBe(0);
});
