// const { webusb } = require('usb');
const { libsane, ...rest } = require('..');

const lib = libsane();

const tsEnumsToSane = {
    SANEStatus: 'SANE_STATUS',
    SANEValueType: 'SANE_TYPE',
    SANEUnit: 'SANE_UNIT',
    SANEConstraintType: 'SANE_CONSTRAINT',
    SANEFrame: 'SANE_FRAME',
};

test('ts enums match sane enums', async () => {
    const l = await lib;
    Object.entries(tsEnumsToSane).forEach(([tsName, saneName]) => {
        expect(rest[tsName]).toContainAllEntries(Object.entries(l[saneName]));
    });
});
