import { LibSANE, SANEOptionDescriptor, SANEStatus, SANEValueType } from ".";

export interface ScanOption<T = any> {
    index: number;
    descriptor: SANEOptionDescriptor;
    value: T;
}

export interface IScanOptions extends Iterable<ScanOption> {
    /**
     * List of all SANE options.
     */
    readonly options: ReadonlyArray<ScanOption>;
    /**
     * Well-known SANE option index zero (total number of options).
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly zero: ScanOption<number>;
    /**
     * Well-known SANE option `resolution`.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly resolution: ScanOption<number> | null;
    /**
     * Well-known SANE option `preview`.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly preview: ScanOption<boolean> | null;
    /**
     * Well-known SANE option `tl-x`.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly tlX: ScanOption<number> | null;
    /**
     * Well-known SANE option `tl-y`.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly tlY: ScanOption<number> | null;
    /**
     * Well-known SANE option `br-x`.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly brX: ScanOption<number> | null;
    /**
     * Well-known SANE option `br-y`.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#well-known-options}
     */
    readonly brY: ScanOption<number> | null;
}

/**
 * @private
 */
export abstract class ScanOptionsBase implements IScanOptions {

    protected _lib!: LibSANE;
    readonly options!: ReadonlyArray<ScanOption>;
    readonly zero!: ScanOption<number>;
    readonly resolution: ScanOption<number> | null = null;
    readonly preview: ScanOption<boolean> | null = null;
    readonly tlX: ScanOption<number> | null = null;
    readonly tlY: ScanOption<number> | null = null;
    readonly brX: ScanOption<number> | null = null;
    readonly brY: ScanOption<number> | null = null;

    [Symbol.iterator](): IterableIterator<ScanOption> {
        return this.options[Symbol.iterator]();
    }

    protected static async _getOpts(lib: LibSANE) {
        const opts: Array<ScanOption> = [];
        let desc: SANEOptionDescriptor | null = null;
        for (let i = 0, n = -1; desc || i === 0; i++) {
            ({ option_descriptor: desc } = lib.sane_get_option_descriptor(i));
            if (desc) {
                if (!desc.cap.INACTIVE && desc.cap.SOFT_DETECT && desc.type !== SANEValueType.BUTTON) {
                    const { status, value } = await lib.sane_control_option_get_value(i);
                    if (status !== SANEStatus.GOOD) {
                        throw new Error(`Unexpected status ${SANEStatus[status]} while getting option value.`);
                    }
                    opts.push({ index: i, descriptor: desc, value });
                    if (i === 0) {
                        n = value; // option 0 contains total number of options
                    }
                } else {
                    opts.push({ index: i, descriptor: desc, value: null });
                }
            } else if (!desc && i !== n) {
                throw new Error('Unexpected number of options.');
            }
        }
        return opts;
    }

    protected constructor(lib: LibSANE, opts: Array<ScanOption>) {
        this._lib = lib;
        this._setOpts(opts);
    }

    protected _setOpts(this: { -readonly [K in keyof ScanOptionsBase]: ScanOptionsBase[K] }, opts: Array<ScanOption>) {
        this.options = opts;
        this.zero = this.options[0];
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].index !== i) {
                throw new Error(`Option index mismatch ${this.options[i].index} != ${i}.`);
            }
            switch (this.options[i].descriptor.name) {
                case 'resolution': this.resolution = this.options[i]; break;
                case 'preview': this.preview = this.options[i]; break;
                case 'tl-x': this.tlX = this.options[i]; break;
                case 'tl-y': this.tlY = this.options[i]; break;
                case 'br-x': this.brX = this.options[i]; break;
                case 'br-y': this.brY = this.options[i]; break;
            }
        }
    }

    protected async _setValue(index: number, value: any) {
        const auto = value === null; // null means auto
        const { status, info } = auto ? await this._lib.sane_control_option_set_auto(index) : await this._lib.sane_control_option_set_value(index, value);
        if (status !== SANEStatus.GOOD) {
            return { status, info, opts: null };
        }
        if (info.RELOAD_OPTIONS) {
            return { status, info, opts: await ScanOptionsBase._getOpts(this._lib) };
        }
        if (info.INEXACT || typeof value === 'number' || auto) {
            // auto triggers get value... ok
            // number triggers get value... this is a quirk for fixed numbers
            // because the conversion from floating to fixed point happens
            // on the library side, we might get INEXACT == false but in
            // reality there were some small difference
            // XXX: this could probably be fixed on the C side
            const { status, value: v } = await this._lib.sane_control_option_get_value(index);
            if (status !== SANEStatus.GOOD) {
                throw new Error(`Unexpected status ${SANEStatus[status]} while getting option value.`);
            }
            value = v;
        }
        // update value
        const opts = [...this.options];
        opts[index] = { ...opts[index], value };
        return { status, info, opts };
    }

    /**
     * Get class instance (with all scanning options).
     */
    static get: (lib: LibSANE) => Promise<IScanOptions>;

    /**
     * Set option value. Use `null` as `value` for automatic.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-control-option}
     */
    abstract setValue(index: number, value: any): any;
}

/**
 * Helper class for getting/setting scan options.
 *
 * Any changes (i.e. calls to {@link ScanOptionsMutable.setValue}) affect the
 * internal state.
 */
export class ScanOptionsMutable extends ScanOptionsBase {

    static async get(lib: LibSANE) {
        return new this(lib, await this._getOpts(lib));
    }

    async setValue(index: number, value: any) {
        const { status, info, opts } = await this._setValue(index, value);
        if (status == SANEStatus.GOOD) {
            this._setOpts(opts);
            return { status, info };
        }
        return { status, info };
    }

}

/**
 * Helper class for getting/setting scan options.
 *
 * Any changes (i.e. calls to {@link ScanOptions.setValue}) return a
 * new class instance.
 */
export class ScanOptions extends ScanOptionsBase {

    static async get(lib: LibSANE) {
        return new this(lib, await this._getOpts(lib));
    }

    async setValue(index: number, value: any) {
        const { status, info, opts } = await this._setValue(index, value);
        if (status == SANEStatus.GOOD) {
            return { status, info, updated: new ScanOptions(this._lib, opts) };
        }
        return { status, info, updated: null };
    }

}
