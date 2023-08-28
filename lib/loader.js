const { version } = require('../package.json');

// we cannot use unpkg as a CDN because they don't set CORP
// Cross-Origin-Resource-Policy: cross-origin
// const cdnURL = `https://unpkg.com/sane-wasm@${version}/build`;

// use good old jsdelivr
const cdnURL = `https://cdn.jsdelivr.net/npm/sane-wasm@${version}/build`;

let libPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        document.head.append(Object.assign(
            document.createElement('script'),
            { src, onload: resolve, onerror: reject }
        ));
    });
}

function fetchFileToBlobURL(src) {
    return fetch(src).then(res => res.ok ? res.blob() : new Blob()).then(blob => URL.createObjectURL(blob));
}

async function prepareLib(options) {
    const jsURL = `${options.sane.loaderURL}/libsane.js`;
    const jsWorkerURL = `${options.sane.loaderURL}/libsane.worker.js`;
    const jsWasmURL = `${options.sane.loaderURL}/libsane.wasm`;

    const filesToPrefetch = options.sane.loaderPrefetchToBlob ? [
        // because of security restrictions around the Worker constructor
        // we need to prefetch the worker js and serve it from a blob
        // see: https://github.com/emscripten-core/emscripten/issues/8338
        jsWorkerURL,
        // since we are already doing all this work to fetch the files in
        // parallel, might as well prefetch the wasm file
        jsWasmURL,
    ] : [];

    const [lib, prefetchResult] = await Promise.all([
        loadScript(jsURL).then(() => {
            const lib = window.LibSANE;
            if (options.sane.loaderRemoveGlobal) {
                window.LibSANE = undefined; // nuke global variable
            }
            return lib;
        }),
        Promise.all(filesToPrefetch.map(url => fetchFileToBlobURL(url).then(urlBlob => ({ url, urlBlob })))),
    ]);

    const preFetchedFiles = prefetchResult.reduce((obj, { url, urlBlob }) => {
        obj[url] = urlBlob;
        return obj;
    }, {});

    return { lib, preFetchedFiles };
}

module.exports = async (options) => {
    options = options || {};
    options.sane = {
        loaderURL: cdnURL,
        loaderPrefetchToBlob: true,
        loaderRemoveGlobal: true,
        ...(options.sane || {}),
    };

    if (!libPromise) {
        libPromise = prepareLib(options);
    }

    const { lib, preFetchedFiles } = await libPromise;
    return lib({
        ...(options || {}),
        locateFile: (path, prefix) => {
            const fullUrl = `${prefix}${path}`;
            return preFetchedFiles[fullUrl] ? preFetchedFiles[fullUrl] : (options.locateFile ? options.locateFile(path, prefix) : fullUrl);
        },
    });
};
