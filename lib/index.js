if (globalThis.window && globalThis.window.document) {
    // browser environment (e.g. webpack)
    module.exports = require('./loader.js');
} else {
    // local environment (e.g. node)
    module.exports = eval('require')('../build/libsane.js');
}
