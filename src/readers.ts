import { LibSANE, SANEFrame, SANEParameters, SANEStatus } from ".";

abstract class EventBaseClass<T extends Record<keyof T, any[]>> {

    private _firing = false;
    private _listeners: {
        [K in keyof T]?: ((...args: T[K]) => void)[];
    } = {};

    /**
     * Add event listener.
     */
    on<K extends keyof T>(type: K, listener: (...args: T[K]) => void) {
        if (!this._listeners[type]) {
            this._listeners[type] = [];
        }
        this._listeners[type]?.push(listener);
    }

    /**
     * Fire event.
     */
    protected fire<K extends keyof T>(type: K, ...args: T[K]): Promise<null> | null {
        // if already firing an event, queue for later
        if (this._firing) {
            return Promise.resolve().then(() => this.fire(type, ...args));
        }
        // fire now
        this._firing = true;
        try {
            this._listeners[type]?.forEach(fn => fn.apply(this, args));
        } finally {
            this._firing = false;
        }
        return null;
    }
}

/**
 * @private Events types for {@link ScanDataReader}.
 */
export interface ScanDataReaderEventMap extends Record<string, any[]> {
    /**
     * Scanning stop event.
     */
    start: [parameters: SANEParameters];
    /**
     * Scanning start event.
     */
    stop: [parameters: SANEParameters, error: Error | null];
    /**
     * Raw image data event.
     */
    data: [parameters: SANEParameters, data: Uint8Array];
}

/**
 * Raw data reader that automatically handles SANE's read code flow.
 *
 * Use {@link ScanDataReader.on} to listen to events, available event types
 * are declared on {@link ScanDataReaderEventMap}.
 *
 * A device should already be open with sane_open(), the reader will call
 * sane_start() do the scanning and call sane_stop().
 *
 * Other SANE functions cannot be used while scanning.
 *
 * Scan readers are single use.
 *
 * {@link https://sane-project.gitlab.io/standard/1.06/api.html#code-flow}
 */
export class ScanDataReader<T extends ScanDataReaderEventMap = ScanDataReaderEventMap> extends EventBaseClass<T> {
    private _lib: LibSANE;
    private _used: boolean = false;
    private _killed: Error | boolean = false;

    constructor(lib: LibSANE) {
        super();
        this._lib = lib;
    }

    private _readPromise(parameters: SANEParameters | null) {
        return new Promise<void>((resolve, reject) => {
            const read = async () => {
                try {
                    if (this._killed) {
                        await this._lib.sane_cancel(); // ignore status
                    }

                    // reads are non-blocking because of how emscripten works
                    // this causes sane_read() to immediately return with
                    // 0 bytes of data, this goes against the SANE spec,
                    // blocking I/O by default
                    // the only option right now is to poll the read using
                    // setTimeout(), this is not ideal
                    // currently even emscripten's asyncify does not help here,
                    // but in the future it might help support blocking I/O
                    // XXX: are we in the future now? can we improve this
                    // https://github.com/emscripten-core/emscripten/issues/13214

                    const { status, data } = await this._lib.sane_read(); // non-blocking

                    if (status === SANEStatus.GOOD) {
                        if (parameters && data.length) {
                            this.fire('data', parameters, data);
                        }

                    } else if (
                        status === SANEStatus.CANCELLED ||
                        // special case for EOF after sane_cancel, after a successful
                        // page read (EOF) and subsequent call to sane_cancel we expected a
                        // CANCELLED status but the test backend never changes from EOF,
                        // this is different on the pixma backend (it changes to CANCELLED),
                        // it's unknown what is the correct option, or what happens on other
                        // backends, handle special case as cancelled for now
                        // XXX: more research
                        // https://sane-project.gitlab.io/standard/1.06/api.html#code-flow
                        (status === SANEStatus.EOF && this._killed)
                    ) {
                        if (this._killed instanceof Error) {
                            reject(this._killed);
                            return;
                        }
                        resolve();
                        return;

                    } else if (status === SANEStatus.EOF) {
                        // image finished
                        this._killed = true;

                    } else {
                        // TODO: handle document feeder / multi-page scans
                        this._killed = new Error(`Status ${SANEStatus[status]} during sane_read().`);

                    }

                    setTimeout(read, data && data.length > 0 ? 10 : 200);
                } catch (e) {
                    const ee = e instanceof Error ? e : new Error("Unknown error while scanning.");
                    if (this._killed) {
                        // already killed, but sane_read is still going? die
                        reject(ee)
                        return;
                    }
                    this._killed = ee;
                    setTimeout(read, 200);
                }
            };
            setTimeout(read, 200);
        });
    }

    /**
     * Start scanning operation.
     */
    async start() {
        if (this._used) {
            // readers are single use
            throw new Error("Scan readers cannot be reused.");
        } else {
            const { status } = await this._lib.sane_start();
            if (status !== SANEStatus.GOOD) {
                return {
                    status,
                    parameters: null,
                    promise: Promise.reject<void>(new Error(`Status ${SANEStatus[status]} during sane_start().`)),
                };
            }
            this._used = true;
        }

        // after successful start, sane_cancel needs to be called and we need
        // to wait for sane_read, so subsequent fails need to use this._killed
        // and run the read loop

        const { status, parameters } = this._lib.sane_get_parameters();
        if (status !== SANEStatus.GOOD) {
            this._killed = new Error(`Status ${SANEStatus[status]} during sane_get_parameters().`);
            return {
                status, parameters,
                promise: this._readPromise(parameters),
            };
        }

        try {
            this.fire('start', parameters);
        } catch (e) {
            this._killed = e instanceof Error ? e : new Error("Unknown error while starting the scan.");
        }

        return {
            status, parameters,
            promise: this._readPromise(parameters).finally(() => {
                this.fire('stop', parameters, this._killed instanceof Error ? this._killed : null);
            }),
        };
    }

    /**
     * Cancel scanning operation.
     */
    cancel() {
        if (this._used && !this._killed) {
            this._killed = true;
        }
    }
}

/**
 * @private Events types for {@link ScanImageReader}.
 */
export interface ScanImageReaderEventMap extends ScanDataReaderEventMap {
    /**
     * Image line event, one or more full lines of RGBA data.
     */
    line: [parameters: SANEParameters, data: Uint8ClampedArray, line: number];
    /**
     * Full image event (end of scan), RGBA data.
     */
    image: [parameters: SANEParameters, data: Uint8ClampedArray];
}

/**
 * Image reader that automatically generates RGBA data while reading from
 * SANE's API using {@link ScanDataReader}. It supports the most common scan
 * modes and image formats. More formats can be added in the future.
 *
 * Use {@link ScanImageReader.on} to listen to events, available event types
 * are declared on {@link ScanImageReaderEventMap}.
 *
 * A device should already be open with sane_open(), the reader will call
 * sane_start() do the scanning and call sane_stop().
 *
 * Other SANE functions cannot be used while scanning.
 *
 * Scan readers are single use.
 *
 * {@link https://sane-project.gitlab.io/standard/1.06/api.html#code-flow}
 */
export class ScanImageReader<T extends ScanImageReaderEventMap = ScanImageReaderEventMap> extends ScanDataReader<T> {

    private _line: number = 0;
    private _allData: Uint8ClampedArray = new Uint8ClampedArray();
    private _remainder = new Uint8ClampedArray();

    constructor(lib: LibSANE) {
        super(lib);
        this.on('start', this._onStart);
        this.on('data', this._onData);
        this.on('stop', this._onStop);
    }

    private _onStart(parameters: SANEParameters) {
        if (parameters.format !== SANEFrame.GRAY && parameters.format !== SANEFrame.RGB) {
            throw new Error(`Invalid format (${JSON.stringify(parameters)}).`);
        }
        if (parameters.depth !== 1 && parameters.depth !== 8) {
            throw new Error(`Invalid bit depth (${JSON.stringify(parameters)}).`);
        }
        if (!parameters.last_frame) {
            throw new Error(`Invalid scanner (3-pass) (${JSON.stringify(parameters)}).`);
        }
        if (parameters.lines < 0) {
            throw new Error(`Invalid scanner (hand-scanner) (${JSON.stringify(parameters)}).`);
        }
        if (parameters.bytes_per_line <= 0 || parameters.pixels_per_line <= 0 || parameters.lines <= 0) {
            throw new Error(`Unexpected image size (${JSON.stringify(parameters)}).`);
        }
        const channels = parameters.format === SANEFrame.GRAY ? 1 : 3;
        const bits = parameters.pixels_per_line * parameters.depth * channels;
        if (parameters.bytes_per_line * 8 < bits) {
            throw new Error(`Unexpected byte count (${JSON.stringify(parameters)}).`);
        }
        // what do we support then?
        // we support GRAY and RGB single-pass, 1 and 8-bit, known height
        // that should cover most modern scanners
        this._allData = new Uint8ClampedArray(parameters.lines * parameters.pixels_per_line * 4);
    }

    private _onData(parameters: SANEParameters, data: Uint8Array) {
        const dataIn = new Uint8ClampedArray(this._remainder.length + data.length);
        dataIn.set(this._remainder, 0);
        dataIn.set(data, this._remainder.length);

        // line count, number of full available lines
        const lc = Math.floor(dataIn.length / parameters.bytes_per_line);
        if (!lc) {
            // not enough data for a full line
            this._remainder = dataIn;
            return;
        }

        const dataOut = new Uint8ClampedArray(lc * parameters.pixels_per_line * 4); // RGBA (8-bit)
        let ik = 0; // consumed data on dataIn
        if (parameters.depth === 8) {
            if (parameters.format === SANEFrame.GRAY) {
                // 8-bit / 1 channel
                for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
                    for (let p = 0, i = ik; p < parameters.pixels_per_line; p++, i++, o += 4) { // for pixels
                        dataOut[o] = dataOut[o + 1] = dataOut[o + 2] = dataIn[i];
                        dataOut[o + 3] = 0xff; // alpha
                    }
                }
            } else {
                // 8-bit / 3 channels
                for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
                    for (let p = 0, i = ik; p < parameters.pixels_per_line; p++, i += 3, o += 4) { // for pixels
                        dataOut.set(dataIn.subarray(i, i + 3), o);
                        dataOut[o + 3] = 0xff; // alpha
                    }
                }
            }
        } else { // parameters.depth == 1
            if (parameters.format === SANEFrame.GRAY) {
                // 1-bit / 1 channel
                for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
                    for (let p = 0, i = ik; p < parameters.pixels_per_line; i++) { // for in bytes
                        for (let mask = 0x80; mask !== 0 && p < parameters.pixels_per_line; mask >>= 1, p++, o += 4) { // for pixels
                            dataOut[o] = dataOut[o + 1] = dataOut[o + 2] = dataIn[i] & mask ? 0x00 : 0xff;
                            dataOut[o + 3] = 0xff; // alpha
                        }
                    }
                }
            } else {
                // 1-bit / 3 channels
                // niche format, probably very few (if any) scanners support this
                // according to the test backend the bits are inverted on this format, if compared
                // with 1-bit gray (1 channel), it remains to be seen if this is correct in the wild
                for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
                    for (let p = 0, i = ik; p < parameters.pixels_per_line; i += 3) { // for in bytes
                        for (let mask = 0x80; mask !== 0 && p < parameters.pixels_per_line; mask >>= 1, p++, o += 4) { // for pixels
                            // rbg is interlaced byte-by-byte not bit-by-bit
                            // so 3 bytes have the R-G-B for 8 pixels
                            dataOut[o] = dataIn[i] & mask ? 0xff : 0x00;
                            dataOut[o + 1] = dataIn[i + 1] & mask ? 0xff : 0x00;
                            dataOut[o + 2] = dataIn[i + 2] & mask ? 0xff : 0x00;
                            dataOut[o + 3] = 0xff; // alpha
                        }
                    }
                }
            }
        }
        this._remainder = dataIn.subarray(ik);
        this.fire('line', parameters, dataOut, this._line);
        this._allData.set(dataOut, this._line * parameters.pixels_per_line * 4);
        this._line += lc;
    }

    private _onStop(parameters: SANEParameters, error: Error | null) {
        if (!error) {
            this.fire('image', parameters, this._allData);
        }
    }

}
