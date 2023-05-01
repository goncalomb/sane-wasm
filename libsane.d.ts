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

export enum SANEValueType {
    BOOL = 0,
    INT,
    FIXED,
    STRING,
    BUTTON,
    GROUP,
}

export enum SANEUnit {
    NONE = 0,
    PIXEL,
    BIT,
    MM,
    DPI,
    PERCENT,
    MICROSECOND,
}

export enum SANEConstraintType {
    NONE = 0,
    RANGE,
    WORD_LIST,
    STRING_LIST,
}

export enum SANEFrame {
    GRAY = 0,
    RGB,
    RED,
    GREEN,
    BLUE,
}

export type SANEState = {
    initialized: boolean;
    version_code: number;
    version: {
        major: number;
        minor: number;
        build: number;
    },
    open: boolean;
}

export type SANEDevice = {
    name: string;
    vendor: string;
    model: string;
    type: string;
}

export type SANEOptionDescriptor = {
    name: string;
    title: string;
    desc: string;
    type: SANEValueType;
    unit: SANEUnit;
    size: number;
    cap: {
        SOFT_SELECT: boolean;
        HARD_SELECT: boolean;
        SOFT_DETECT: boolean;
        EMULATED: boolean;
        AUTOMATIC: boolean;
        INACTIVE: boolean;
        ADVANCED: boolean;
    };
} & ({
    constraint_type: SANEConstraintType.NONE
    constraint: null
} | {
    constraint_type: SANEConstraintType.RANGE
    constraint: {
        min: number;
        max: number;
        quant: number;
    }
} | {
    constraint_type: SANEConstraintType.WORD_LIST
    constraint: number[]
} | {
    constraint_type: SANEConstraintType.STRING_LIST
    constraint: string[]
})

export type SANEInfo = {
    INEXACT: boolean;
    RELOAD_OPTIONS: boolean;
    RELOAD_PARAMS: boolean;
}

export type SANEParameters = {
    format: SANEFrame;
    last_frame: boolean;
    bytes_per_line: number;
    pixels_per_line: number;
    lines: number;
    depth: number;
}

type SANEEnum<E, TE> = E & {
    asString: (value: TE) => string;
}

export interface LibSANE {
    SANE_WASM_COMMIT: string;
    SANE_WASM_VERSION: string;
    SANE_WASM_BACKENDS: string;

    SANE_CURRENT_MAJOR: number;
    SANE_CURRENT_MINOR: number;

    SANE_STATUS: SANEEnum<typeof SANEStatus, SANEStatus>;
    SANE_TYPE: SANEEnum<typeof SANEValueType, SANEValueType>;
    SANE_UNIT: SANEEnum<typeof SANEUnit, SANEUnit>;
    SANE_CONSTRAINT: SANEEnum<typeof SANEConstraintType, SANEConstraintType>;
    SANE_FRAME: SANEEnum<typeof SANEFrame, SANEFrame>;

    sane_get_state: () => SANEState;
    sane_init: () => { status: SANEStatus; version_code: number };
    sane_exit: () => Promise<{ status: SANEStatus; }>;
    sane_get_devices: () => Promise<{ status: SANEStatus; devices: SANEDevice[] }>;
    sane_open: (devicename: string) => Promise<{ status: SANEStatus; }>;
    sane_close: () => Promise<{ status: SANEStatus; }>;
    sane_get_option_descriptor: (option: number) => { status: SANEStatus; option_descriptor: SANEOptionDescriptor | null };
    sane_control_option_get_value: (option: number) => Promise<{ status: SANEStatus; value: any }>;
    sane_control_option_set_value: (option: number, value: any) => Promise<{ status: SANEStatus; info: SANEInfo }>;
    sane_control_option_set_auto: (option: number) => Promise<{ status: SANEStatus; info: SANEInfo }>;
    sane_get_parameters: () => { status: SANEStatus; parameters: SANEParameters };
    sane_start: () => { status: SANEStatus; };
    sane_read: () => Promise<{ status: SANEStatus; data: Uint8Array }>;
    sane_cancel: () => Promise<{ status: SANEStatus; }>;
    sane_strstatus: (status: SANEStatus) => string;
}

export type LibSANEFactory = (option?: {
    sane?: {
        debugSANE?: boolean;
        debugUSB?: boolean;
        debugFunctionCalls?: boolean;
        debugTestDevices?: number;
        promisify?: boolean;
        promisifyQueue?: boolean;
    }
} & {
    [k: string]: any
}) => Promise<LibSANE>
