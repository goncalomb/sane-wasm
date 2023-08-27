// const { webusb } = require('usb');
const sane = require('..');

const lib = sane({
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

test('sane_exit', async () => {
    const l = await lib;
    expect(await l.sane_exit()).toMatchObject({
        status: l.SANE_STATUS.GOOD,
    });
    expect(await l.sane_exit()).toEqual({
        status: l.SANE_STATUS.INVAL,
    });
});
