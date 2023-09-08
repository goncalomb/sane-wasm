/**
 * Equivalent to the SANE API C enum `SANE_Status`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#status-type}
 */
export enum SANEStatus {
    GOOD = 0,
    UNSUPPORTED,
    CANCELLED,
    DEVICE_BUSY,
    INVAL,
    EOF,
    JAMMED,
    NO_DOCS,
    COVER_OPEN,
    IO_ERROR,
    NO_MEM,
    ACCESS_DENIED,
}

/**
 * Equivalent to the SANE API C enum `SANE_Value_Type`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#option-value-type}
 */
export enum SANEValueType {
    BOOL = 0,
    INT,
    FIXED,
    STRING,
    BUTTON,
    GROUP,
}

/**
 * Equivalent to the SANE API C enum `SANE_Unit`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#option-value-unit}
 */
export enum SANEUnit {
    NONE = 0,
    PIXEL,
    BIT,
    MM,
    DPI,
    PERCENT,
    MICROSECOND,
}

/**
 * Equivalent to the SANE API C enum `SANE_Constraint_Type`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#option-value-constraints}
 */
export enum SANEConstraintType {
    NONE = 0,
    RANGE,
    WORD_LIST,
    STRING_LIST,
}

/**
 * Equivalent to the SANE API C enum `SANE_Frame`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-get-parameters}
 */
export enum SANEFrame {
    GRAY = 0,
    RGB,
    RED,
    GREEN,
    BLUE,
}

/**
 * Library state. This is provided by sane-wasm, it's not part of SANE API.
 */
export type SANEState = {
    /**
     * Is the library initialized with {@link LibSANE.sane_init}?
     */
    initialized: boolean;
    /**
     * Version code provided by the last {@link LibSANE.sane_init} call.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#version-control}
     */
    version_code: number;
    /**
     * Version code (decoded) provided by the last {@link LibSANE.sane_init} call.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#version-control}
     */
    version: {
        major: number;
        minor: number;
        build: number;
    },
    /**
     * Is a device open with {@link LibSANE.sane_open}?
     */
    open: boolean;
}

/**
 * Equivalent to the SANE API C type `SANE_Device`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#device-descriptor-type}
 */
export type SANEDevice = {
    name: string;
    vendor: string;
    model: string;
    type: string;
}

/**
 * Equivalent to the SANE API C bit mask `SANE_CAP_*`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#option-capabilities}
 */
export type SANECap = {
    SOFT_SELECT: boolean;
    HARD_SELECT: boolean;
    SOFT_DETECT: boolean;
    EMULATED: boolean;
    AUTOMATIC: boolean;
    INACTIVE: boolean;
    ADVANCED: boolean;
}

/**
 * Equivalent to the SANE API C type `SANE_Range`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#option-descriptor-type}
 */
export type SANERange = {
    min: number;
    max: number;
    quant: number;
}

/**
 * Equivalent to the SANE API C type `SANE_Option_Descriptor`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#option-descriptor-type}
 */
export type SANEOptionDescriptor = {
    name: string;
    title: string;
    desc: string;
    type: SANEValueType;
    unit: SANEUnit;
    size: number;
    cap: SANECap;
} & ({
    constraint_type: SANEConstraintType.NONE
    constraint: null
} | {
    constraint_type: SANEConstraintType.RANGE
    constraint: SANERange
} | {
    constraint_type: SANEConstraintType.WORD_LIST
    constraint: number[]
} | {
    constraint_type: SANEConstraintType.STRING_LIST
    constraint: string[]
})

/**
 * Equivalent to the SANE API C bit mask `SANE_INFO_*`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-control-option}
 */
export type SANEInfo = {
    INEXACT: boolean;
    RELOAD_OPTIONS: boolean;
    RELOAD_PARAMS: boolean;
}

/**
 * Equivalent to the SANE API C type `SANE_Parameters`.
 * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-get-parameters}
 */
export type SANEParameters = {
    format: SANEFrame;
    last_frame: boolean;
    bytes_per_line: number;
    pixels_per_line: number;
    lines: number;
    depth: number;
}

/**
 * @private Type for enums provided by the core SANE Emscripten module.
 * @deprecated
 */
export type SANEEnum<E, TE> = E & {
    /**
     * @deprecated Use reverse map already built into TS enums.
     */
    asString: (value: TE) => string;
}

/**
 * The core SANE Emscripten module.
 */
export interface LibSANE {
    /**
     * Commit hash of sane-wasm.
     */
    SANE_WASM_COMMIT: string;

    /**
     * Version code of sane-wasm.
     */
    SANE_WASM_VERSION: string;

    /**
     * List of SANE API backends built into sane-wasm.
     */
    SANE_WASM_BACKENDS: string;

    /**
     * SANE API version code (major).
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#version-control}
     */
    SANE_CURRENT_MAJOR: number;

    /**
     * SANE API version code (minor).
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#version-control}
     */
    SANE_CURRENT_MINOR: number;

    /**
     * @deprecated Consider using the SANEStatus enum directly.
     *
     * This object is not going away anytime soon (or ever probably).
     *
     * But you should consider using the equivalent enum because it doesn't
     * require having a reference to the library module. All enums are
     * exported with the package.
     */
    SANE_STATUS: SANEEnum<typeof SANEStatus, SANEStatus>;

    /**
     * @deprecated Consider using the SANEValueType enum directly.
     *
     * This object is not going away anytime soon (or ever probably).
     *
     * But you should consider using the equivalent enum because it doesn't
     * require having a reference to the library module. All enums are
     * exported with the package.
     */
    SANE_TYPE: SANEEnum<typeof SANEValueType, SANEValueType>;

    /**
     * @deprecated Consider using the SANEUnit enum directly.
     *
     * This object is not going away anytime soon (or ever probably).
     *
     * But you should consider using the equivalent enum because it doesn't
     * require having a reference to the library module. All enums are
     * exported with the package.
     */
    SANE_UNIT: SANEEnum<typeof SANEUnit, SANEUnit>;

    /**
     * @deprecated Consider using the SANEConstraintType enum directly.
     *
     * This object is not going away anytime soon (or ever probably).
     *
     * But you should consider using the equivalent enum because it doesn't
     * require having a reference to the library module. All enums are
     * exported with the package.
     */
    SANE_CONSTRAINT: SANEEnum<typeof SANEConstraintType, SANEConstraintType>;

    /**
     * @deprecated Consider using the SANEFrame enum directly.
     *
     * This object is not going away anytime soon (or ever probably).
     *
     * But you should consider using the equivalent enum because it doesn't
     * require having a reference to the library module. All enums are
     * exported with the package.
     */
    SANE_FRAME: SANEEnum<typeof SANEFrame, SANEFrame>;

    /**
     * Get the current state of the library.
     *
     * This is provided by sane-wasm, it's not part of SANE API.
     */
    sane_get_state: () => SANEState;

    /**
     * Equivalent to the SANE API C function `sane_init`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-init}
     */
    sane_init: () => { status: SANEStatus.GOOD; version_code: number } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; version_code: null };

    /**
     * Equivalent to the SANE API C function `sane_exit`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-exit}
     */
    sane_exit: () => Promise<{ status: SANEStatus; }>;

    /**
     * Equivalent to the SANE API C function `sane_get_devices`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-get-devices}
     */
    sane_get_devices: () => Promise<{ status: SANEStatus.GOOD; devices: SANEDevice[] } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; devices: null }>;

    /**
     * Equivalent to the SANE API C function `sane_open`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-open}
     */
    sane_open: (devicename: string) => Promise<{ status: SANEStatus; }>;

    /**
     * Equivalent to the SANE API C function `sane_close`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-close}
     */
    sane_close: () => Promise<{ status: SANEStatus; }>;

    /**
     * Equivalent to the SANE API C function `sane_get_option_descriptor`.
     *
     * The result `option_descriptor` can be null even with
     * `status = SANEStatus.GOOD`, it signals invalid option index.
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-get-option-descriptor}
     */
    sane_get_option_descriptor: (option: number) => { status: SANEStatus; option_descriptor: SANEOptionDescriptor | null };

    /**
     * Equivalent to the SANE API C function `sane_control_option`.
     *
     * With `a = SANE_ACTION_GET_VALUE` (get option value).
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-control-option}
     */
    sane_control_option_get_value: (option: number) => Promise<{ status: SANEStatus.GOOD; value: any } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; value: null }>;

    /**
     * Equivalent to the SANE API C function `sane_control_option`.
     *
     * With `a = SANE_ACTION_SET_VALUE` (set option value).
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-control-option}
     */
    sane_control_option_set_value: (option: number, value: any) => Promise<{ status: SANEStatus.GOOD; info: SANEInfo } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; info: null }>;

    /**
     * Equivalent to the SANE API C function `sane_control_option`.
     *
     * With `a = SANE_ACTION_SET_AUTO` (set option automatic).
     *
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-control-option}
     */
    sane_control_option_set_auto: (option: number) => Promise<{ status: SANEStatus.GOOD; info: SANEInfo } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; info: null }>;

    /**
     * Equivalent to the SANE API C function `sane_get_parameters`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-get-parameters}
     */
    sane_get_parameters: () => { status: SANEStatus.GOOD; parameters: SANEParameters } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; parameters: null };

    /**
     * Equivalent to the SANE API C function `sane_start`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-start}
     */
    sane_start: () => { status: SANEStatus; };

    /**
     * Equivalent to the SANE API C function `sane_read`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-read}
     */
    sane_read: () => Promise<{ status: SANEStatus.GOOD; data: Uint8Array } | { status: Exclude<SANEStatus, SANEStatus.GOOD>; data: null }>;

    /**
     * Equivalent to the SANE API C function `sane_cancel`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-cancel}
     */
    sane_cancel: () => Promise<{ status: SANEStatus; }>;

    /**
     * Equivalent to the SANE API C function `sane_strstatus`.
     * @see {@link https://sane-project.gitlab.io/standard/1.06/api.html#sane-strstatus}
     */
    sane_strstatus: (status: SANEStatus) => string;
}

/**
 * SANE Emscripten module options (specific to sane-wasm).
 */
export type LibSANEOptions = {
    /**
     * Loader URL that serves the build artifacts (libsane.js etc.).
     *
     * The loader is only used on web environments.
     *
     * @defaultvalue "sane-wasm @ jsdelivr.net"
     */
    loaderURL?: string;
    /**
     * Should the loader prefetch the resources to a Bob object? This is
     * required when loading from a different origin. Check the loader
     * code for more information.
     *
     * The loader is only used on web environments.
     *
     * @defaultvalue `true`
     */
    loaderPrefetchToBlob?: boolean;
    /**
     * Should the loader remove the global module variable `window.LibSANE`?
     *
     * The loader is only used on web environments.
     *
     * @defaultvalue `true`
     */
    loaderRemoveGlobal?: boolean;
    /**
     * Enables SANE low-level debug messages, this can be quite verbose.
     *
     * @defaultvalue `false`
     */
    debugSANE?: boolean;
    /**
     * Enables libusb low-level debug messages, this can be quite verbose.
     *
     * @defaultvalue `false`
     */
    debugUSB?: boolean;
    /**
     * Enables debug messages for SANE function calls.
     *
     * @defaultvalue `false`
     */
    debugFunctionCalls?: boolean;
    /**
     * Sets the number of test devices for SANE's test backend.
     *
     * @defaultvalue `0`
     */
    debugTestDevices?: number;
    /**
     * Enables sane-wasm "promisify" to normalize the API. See pre.js for more
     * information.
     *
     * @deprecated Setting this to `false` changes the API definition! Some
     * functions may stop being asynchronous in some cases. You want this
     * option enabled! This option may be removed in the future.
     *
     * @defaultvalue `true`
     */
    promisify?: boolean;
    /**
     * Enables sane-wasm "promisify" queue that queues function calls to
     * prevent issues with calling multiple asynchronous functions. See pre.js
     * for more information.
     *
     * @deprecated You want this option enabled! This option may be removed in
     * the future.
     *
     * @defaultvalue `true`
     */
    promisifyQueue?: boolean;
}

/**
 * The factory that initializes the core SANE Emscripten module.
 */
export type LibSANEFactory = (options?: {
    /**
     * Emscripten module options specific to sane-wasm.
     */
    sane?: LibSANEOptions;
    /**
     * Other Emscripten module options.
     */
    [k: string]: any;
}) => Promise<LibSANE>

/**
 * Main LibSANE factory.
 */
export const libsane = require('../lib') as LibSANEFactory;

/**
 * @deprecated The default export may be removed in the future.
 * Use the 'libsane' named export.
 */
export default libsane;

export * from './readers';
