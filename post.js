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
    // When running on Node.js inject USB API on navigator object to simulate
    // a browser environment, this is required for libusb to find it.
    // see: deps/libusb/libusb/os/emscripten_webusb.cpp
    // https://github.com/node-usb/node-usb
    // https://www.npmjs.com/package/usb
    if (ENVIRONMENT_IS_NODE) {
        if (!globalThis.navigator) {
            globalThis.navigator = {};
        }
        if (!globalThis.navigator.usb) {
            globalThis.navigator.usb = require('usb').webusb;
        }
    }
}
