import { expect, test } from 'vitest';
import { libsane } from '..';

const lib = libsane({
    sane: {
        debugTestDevices: 7,
    },
});

test('sane_init', async () => {
    const l = await lib;
    expect(await l.sane_init()).toMatchObject({
        status: l.SANE_STATUS.GOOD,
        version_code: expect.toBePositive(),
    });
    expect(await l.sane_init()).toEqual({
        status: l.SANE_STATUS.INVAL,
        version_code: null,
    });
});

test('sane_get_devices', async () => {
    const l = await lib;
    const result = await l.sane_get_devices();
    expect(result).toMatchObject({
        status: l.SANE_STATUS.GOOD,
        devices: expect.toBeArrayOfSize(7),
    });
});

// XXX: sane-wasm may be fundamentally broken on node.js (thread-related issue?)
/*
test('sane_read blocks and returns data', async () => {
    const l = await lib;
    const { devices } = await l.sane_get_devices();
    expect(devices.length).toBeGreaterThan(0);

    const openRes = await l.sane_open(devices[0].name);
    expect(openRes.status).toBe(l.SANE_STATUS.GOOD);

    const startRes = await l.sane_start();
    expect(startRes.status).toBe(l.SANE_STATUS.GOOD);

    const readRes = await l.sane_read();
    expect(readRes.status).toBe(l.SANE_STATUS.GOOD);
    expect(readRes.data).toBeInstanceOf(Uint8Array);
    expect(readRes.data.length).toBeGreaterThan(0);

    await l.sane_cancel();
    await l.sane_close();
});
*/

test('sane_exit', async () => {
    const l = await lib;
    expect(await l.sane_exit()).toMatchObject({
        status: l.SANE_STATUS.GOOD,
    });
    expect(await l.sane_exit()).toEqual({
        status: l.SANE_STATUS.INVAL,
    });
});
