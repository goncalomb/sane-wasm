import crypto from 'node:crypto';
import { expect, test } from 'vitest';
import { libsane, SANEStatus, ScanImageReader, ScanOptionsMutable } from '..';

const lib = libsane({
    sane: {
        backends: ['test'],
        debugTestDevices: 7,
    },
});

const hashData = (data: NodeJS.ArrayBufferView) => crypto.createHash('sha256').update(data).digest('hex');

test('sane_init', async () => {
    const l = await lib;
    const { status, version_code } = await l.sane_init();
    expect(status).toBe(SANEStatus.GOOD);
    expect(version_code).toBeGreaterThan(0);
});

test('sane_open', async () => {
    const l = await lib;
    const { status, devices } = await l.sane_get_devices();
    expect(status).toBe(SANEStatus.GOOD);
    expect(devices).toBeInstanceOf(Array);
    expect(devices?.length).toBe(7);
    if (devices?.length) {
        const { status } = await l.sane_open(devices[0].name);
        expect(status).toBe(SANEStatus.GOOD);
    }
});

test.for([
    'Solid black', 'Solid white', 'Color pattern', 'Grid',
])('image reader (%s)', async (picture) => {
    const opts = await ScanOptionsMutable.get(await lib);
    await opts.setValue(2, 'Color'); // mode
    await opts.setValue(10, picture); // test-picture

    const reader = new ScanImageReader(await lib);
    reader.on('image', (parameters, data) => {
        expect(parameters).not.toBeNull();
        expect(['image', data.length, hashData(data)]).toMatchSnapshot();
    });

    const { status, parameters, promise } = await reader.start();
    expect(status).toBe(SANEStatus.GOOD);
    expect(parameters).not.toBeNull();
    await promise;
});

test('sane_close', async () => {
    const l = await lib;
    const { status } = await l.sane_close();
    expect(status).toBe(SANEStatus.GOOD);
});

test('sane_exit', async () => {
    const l = await lib;
    const { status } = await l.sane_exit();
    expect(status).toBe(SANEStatus.GOOD);
});
