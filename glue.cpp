#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <sane/sane.h>
#include <string.h>
#include <string>

#include "build/version.h"

using namespace emscripten;

#define BUFFER_LEN 2*1024*1024

SANE_Int version_code = 0;
SANE_Handle handle = NULL;
SANE_Byte buffer[BUFFER_LEN];

val build_response(SANE_Status status, const char *key, const val &value = val::null()) {
    val obj = val::object();
    obj.set("status", (int) status);
    obj.set(key, value);
    return obj;
}

val build_response(SANE_Status status) {
    val obj = val::object();
    obj.set("status", (int) status);
    return obj;
}

#define RETURN_IF_ERROR(status) if (status != SANE_STATUS_GOOD) return build_response(status);
#define RETURN_IF_ERROR_KEY(status, key) if (status != SANE_STATUS_GOOD) return build_response(status, key);

val bitmap_cap_to_val(SANE_Int cap) {
    val obj = val::object();
    obj.set("SOFT_SELECT", (bool) ((cap & SANE_CAP_SOFT_SELECT) != 0));
    obj.set("HARD_SELECT", (bool) ((cap & SANE_CAP_HARD_SELECT) != 0));
    obj.set("SOFT_DETECT", (bool) ((cap & SANE_CAP_SOFT_DETECT) != 0));
    obj.set("EMULATED", (bool) ((cap & SANE_CAP_EMULATED) != 0));
    obj.set("AUTOMATIC", (bool) ((cap & SANE_CAP_AUTOMATIC) != 0));
    obj.set("INACTIVE", (bool) ((cap & SANE_CAP_INACTIVE) != 0));
    obj.set("ADVANCED", (bool) ((cap & SANE_CAP_ADVANCED) != 0));
    return obj;
}

val bitmap_info_to_val(SANE_Int info) {
    val obj = val::object();
    obj.set("INEXACT", (bool) ((info & SANE_INFO_INEXACT) != 0));
    obj.set("RELOAD_OPTIONS", (bool) ((info & SANE_INFO_RELOAD_OPTIONS) != 0));
    obj.set("RELOAD_PARAMS", (bool) ((info & SANE_INFO_RELOAD_PARAMS) != 0));
    return obj;
}

// SANE API

namespace sane {

    // SANE_Status
    std::map<const char *, int> SANE_STATUS = {
        {"GOOD", SANE_STATUS_GOOD},
        {"UNSUPPORTED", SANE_STATUS_UNSUPPORTED},
        {"CANCELLED", SANE_STATUS_CANCELLED},
        {"DEVICE_BUSY", SANE_STATUS_DEVICE_BUSY},
        {"INVAL", SANE_STATUS_INVAL},
        {"EOF", SANE_STATUS_EOF},
        {"JAMMED", SANE_STATUS_JAMMED},
        {"NO_DOCS", SANE_STATUS_NO_DOCS},
        {"COVER_OPEN", SANE_STATUS_COVER_OPEN},
        {"IO_ERROR", SANE_STATUS_IO_ERROR},
        {"NO_MEM", SANE_STATUS_NO_MEM},
        {"ACCESS_DENIED", SANE_STATUS_ACCESS_DENIED},
    };

    // SANE_Value_Type
    std::map<const char *, int> SANE_TYPE = {
        {"BOOL", SANE_TYPE_BOOL},
        {"INT", SANE_TYPE_INT},
        {"FIXED", SANE_TYPE_FIXED},
        {"STRING", SANE_TYPE_STRING},
        {"BUTTON", SANE_TYPE_BUTTON},
        {"GROUP", SANE_TYPE_GROUP},
    };

    // SANE_Unit
    std::map<const char *, int> SANE_UNIT = {
        {"NONE", SANE_UNIT_NONE},
        {"PIXEL", SANE_UNIT_PIXEL},
        {"BIT", SANE_UNIT_BIT},
        {"MM", SANE_UNIT_MM},
        {"DPI", SANE_UNIT_DPI},
        {"PERCENT", SANE_UNIT_PERCENT},
        {"MICROSECOND", SANE_UNIT_MICROSECOND},
    };

    // SANE_Constraint_Type
    std::map<const char *, int> SANE_CONSTRAINT = {
        {"NONE", SANE_CONSTRAINT_NONE},
        {"RANGE", SANE_CONSTRAINT_RANGE},
        {"WORD_LIST", SANE_CONSTRAINT_WORD_LIST},
        {"STRING_LIST", SANE_CONSTRAINT_STRING_LIST},
    };

    // SANE_Action not used on the exposed api

    // SANE_Frame
    std::map<const char *, int> SANE_FRAME = {
        {"GRAY", SANE_FRAME_GRAY},
        {"RGB", SANE_FRAME_RGB},
        {"RED", SANE_FRAME_RED},
        {"GREEN", SANE_FRAME_GREEN},
        {"BLUE", SANE_FRAME_BLUE},
    };

    val sane_get_state() {
        val version = val::object();
        version.set("major", SANE_VERSION_MAJOR(version_code));
        version.set("minor", SANE_VERSION_MINOR(version_code));
        version.set("build", SANE_VERSION_BUILD(version_code));
        val state = val::object();
        state.set("initialized", !!version_code);
        state.set("version_code", version_code);
        state.set("version", version);
        state.set("open", !!handle);
        return state;
    }

    val sane_init() {
        if (version_code) {
            return build_response(SANE_STATUS_INVAL, "version_code");
        }

        SANE_Status status = ::sane_init(&version_code, NULL);
        RETURN_IF_ERROR_KEY(status, "version_code");

        return build_response(status, "version_code", val(version_code));
    }

    void sane_exit() {
        ::sane_exit();
        version_code = 0;
        handle = NULL;
    }

    val sane_get_devices() {
        const SANE_Device **device_list;
        SANE_Status status = ::sane_get_devices(&device_list, SANE_TRUE);
        RETURN_IF_ERROR_KEY(status, "devices");

        val devices = val::array();
        for (int i = 0; device_list[i]; i++) {
            val device = val::object();
            device.set("name", device_list[i]->name);
            device.set("vendor", device_list[i]->vendor);
            device.set("model", device_list[i]->model);
            device.set("type", device_list[i]->type);
            devices.call<void>("push", device);
        }
        return build_response(status, "devices", devices);
    }

    val sane_open(std::string devicename) {
        if (!version_code || handle) {
            return build_response(SANE_STATUS_INVAL);
        }

        SANE_Status status = ::sane_open(devicename.c_str(), &handle);
        return build_response(status);
    }

    void sane_close() {
        if (handle) {
            ::sane_close(handle);
            handle = NULL;
        }
    }

    val sane_get_option_descriptor(int option) {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL, "option_descriptor");
        }

        const SANE_Option_Descriptor *desc = ::sane_get_option_descriptor(handle, option);
        if (desc == NULL) {
            return build_response(SANE_STATUS_GOOD, "option_descriptor");
        }

        // convert size, we don't need to expose size in byte units
        // for the frontend is more useful in "number of words" (items)
        int size = desc->size;
        switch (desc->type) {
            case SANE_TYPE_BOOL: size = size/sizeof(SANE_Bool); break;
            case SANE_TYPE_INT: size = size/sizeof(SANE_Int); break;
            case SANE_TYPE_FIXED: size = size/sizeof(SANE_Fixed); break;
            case SANE_TYPE_STRING: size = size/sizeof(SANE_Char) - 1; break;
            case SANE_TYPE_BUTTON: break;
            case SANE_TYPE_GROUP: break;
        }

        // decode and convert constraint
        val constraint = val::null();
        if (desc->constraint_type == SANE_CONSTRAINT_RANGE) {
            constraint = val::object();
            if (desc->type == SANE_TYPE_FIXED) {
                constraint.set("min", SANE_UNFIX(desc->constraint.range->min));
                constraint.set("max", SANE_UNFIX(desc->constraint.range->max));
                constraint.set("quant", SANE_UNFIX(desc->constraint.range->quant));
            } else {
                constraint.set("min", desc->constraint.range->min);
                constraint.set("max", desc->constraint.range->max);
                constraint.set("quant", desc->constraint.range->quant);
            }
        } else if (desc->constraint_type == SANE_CONSTRAINT_WORD_LIST) {
            constraint = val::array();
            if (desc->type == SANE_TYPE_FIXED) {
                for (int i = 1; i <= desc->constraint.word_list[0]; i++) {
                    constraint.call<void>("push", SANE_UNFIX(desc->constraint.word_list[i]));
                }
            } else {
                for (int i = 1; i <= desc->constraint.word_list[0]; i++) {
                    constraint.call<void>("push", desc->constraint.word_list[i]);
                }
            }
        } else if (desc->constraint_type == SANE_CONSTRAINT_STRING_LIST) {
            constraint = val::array();
            for (const SANE_String_Const *str = desc->constraint.string_list; *str != NULL; str++) {
                constraint.call<void>("push", val(*str));
            }
        }

        // construct final object
        val option_descriptor = val::object();
        option_descriptor.set("name", desc->name);
        option_descriptor.set("title", desc->title);
        option_descriptor.set("desc", desc->desc);
        option_descriptor.set("type", (int) desc->type);
        option_descriptor.set("unit", (int) desc->unit);
        option_descriptor.set("size", size);
        option_descriptor.set("cap", bitmap_cap_to_val(desc->cap));
        option_descriptor.set("constraint_type", (int) desc->constraint_type);
        option_descriptor.set("constraint", constraint);
        return build_response(SANE_STATUS_GOOD, "option_descriptor", option_descriptor);
    }

    val sane_control_option_get_value(int option) {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL, "value");
        }

        const SANE_Option_Descriptor *desc = ::sane_get_option_descriptor(handle, option);
        if (desc == NULL) {
            return build_response(SANE_STATUS_INVAL, "value");
        }

        void *v = NULL;
        if (desc->size > 0) {
            v = malloc(desc->size);
            if (!v) {
                return build_response(SANE_STATUS_NO_MEM, "value");
            }
        }

        SANE_Int info = 0; // discard
        SANE_Status status = ::sane_control_option(handle, option, SANE_ACTION_GET_VALUE, v, &info);
        // RETURN_IF_ERROR_KEY(status, "value");

        if (status != SANE_STATUS_GOOD) {
            if (v) {
                free(v);
            }
            return build_response(status, "value");
        }

        val value = val::null();
        int n;
        switch (desc->type) {
            case SANE_TYPE_BOOL:
                value = val((bool) *((SANE_Bool *) v));
                break;
            case SANE_TYPE_INT:
                n = desc->size/sizeof(SANE_Int);
                if (n == 1) {
                    value = val(*((SANE_Int *) v));
                } else if (n > 1) {
                    value = val::array();
                    for (int i = 0; i < n; i++) {
                        value.call<void>("push", ((SANE_Int *) v)[i]);
                    }
                }
                break;
            case SANE_TYPE_FIXED:
                n = desc->size/sizeof(SANE_Fixed);
                if (n == 1) {
                    value = val(SANE_UNFIX(*((SANE_Fixed *) v)));
                } else if (n > 1) {
                    value = val::array();
                    for (int i = 0; i < n; i++) {
                        value.call<void>("push", SANE_UNFIX(((SANE_Fixed *) v)[i]));
                    }
                }
                break;
            case SANE_TYPE_STRING:
                value = val((SANE_String_Const) v);
                break;
            case SANE_TYPE_BUTTON:
            case SANE_TYPE_GROUP:
            default:
                break;
        }

        if (v) {
            free(v);
        }

        return build_response(status, "value", value);
    }

    val sane_control_option_set_value(int option, val value) {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL, "info");
        }

        const SANE_Option_Descriptor *desc = ::sane_get_option_descriptor(handle, option);
        if (desc == NULL) {
            return build_response(SANE_STATUS_INVAL, "info");
        }

        void *v = NULL;
        if (desc->size > 0) {
            v = malloc(desc->size);
            if (!v) {
                return build_response(SANE_STATUS_NO_MEM, "info");
            }
        }

        int n;
        bool inval = false;
        switch (desc->type) {
            case SANE_TYPE_BOOL:
                if (value.isTrue()) {
                    *((SANE_Bool *) v) = SANE_TRUE;
                } else if (value.isFalse()) {
                    *((SANE_Bool *) v) = SANE_FALSE;
                } else {
                    inval = true;
                }
                break;
            case SANE_TYPE_INT:
                n = desc->size/sizeof(SANE_Int);
                if (n == 1) {
                    if (value.isNumber()) {
                        *((SANE_Int *) v) = value.as<int>();
                    } else {
                        inval = true;
                    }
                } else if (n > 1) {
                    if (value.isArray()) {
                        auto vec = vecFromJSArray<int>(value);
                        for (int i = 0; i < vec.size() && i < n; i++) {
                            ((SANE_Int *) v)[i] = vec[i];
                        }
                    } else {
                        inval = true;
                    }
                }
                break;
            case SANE_TYPE_FIXED:
                n = desc->size/sizeof(SANE_Fixed);
                if (n == 1) {
                    if (value.isNumber()) {
                        *((SANE_Fixed *) v) = SANE_FIX(value.as<double>());
                    } else {
                        inval = true;
                    }
                } else if (n > 1) {
                    if (value.isArray()) {
                        auto vec = vecFromJSArray<double>(value);
                        for (int i = 0; i < vec.size() && i < n; i++) {
                            ((SANE_Fixed *) v)[i] = SANE_FIX(vec[i]);
                        }
                    } else {
                        inval = true;
                    }
                }
                break;
            case SANE_TYPE_STRING:
                if (value.isString()) {
                    int n = desc->size/sizeof(SANE_Char) - 1;
                    std::string str = value.as<std::string>();
                    strncpy((char *) v, str.c_str(), n);
                    ((char *) v)[n] = 0x00;
                } else {
                    inval = true;
                }
                break;
            case SANE_TYPE_BUTTON:
            case SANE_TYPE_GROUP:
            default:
                break;
        }

        if (inval) {
            if (v) {
                free(v);
            }
            return build_response(SANE_STATUS_INVAL, "info");
        }

        SANE_Int info = 0;
        SANE_Status status = ::sane_control_option(handle, option, SANE_ACTION_SET_VALUE, v, &info);

        if (v) {
            free(v);
        }

        RETURN_IF_ERROR_KEY(status, "info");

        return build_response(status, "info", bitmap_info_to_val(info));
    }

    val sane_control_option_set_auto(int option) {
        SANE_Int info = 0;
        SANE_Status status = ::sane_control_option(handle, option, SANE_ACTION_SET_AUTO, NULL, &info);
        RETURN_IF_ERROR_KEY(status, "info");
        return build_response(status, "info", bitmap_info_to_val(info));
    }

    val sane_get_parameters() {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL, "parameters");
        }

        SANE_Parameters params;
        SANE_Status status = ::sane_get_parameters(handle, &params);
        RETURN_IF_ERROR_KEY(status, "parameters");

        val parameters = val::object();
        parameters.set("format", (int) params.format);
        parameters.set("last_frame", (bool) params.last_frame);
        parameters.set("bytes_per_line", params.bytes_per_line);
        parameters.set("pixels_per_line", params.pixels_per_line);
        parameters.set("lines", params.lines);
        parameters.set("depth", params.depth);
        return build_response(status, "parameters", parameters);
    }

    val sane_start() {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL);
        }

        SANE_Status status = ::sane_start(handle);
        return build_response(status);
    }

    val sane_read() {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL, "data");
        }

        SANE_Int len = 0;
        SANE_Status status = ::sane_read(handle, buffer, BUFFER_LEN, &len);
        val data = val(typed_memory_view(len, buffer));
        return build_response(status, "data", data);
    }

    val sane_cancel() {
        if (!handle) {
            return build_response(SANE_STATUS_INVAL);
        }

        ::sane_cancel(handle);
        return build_response(SANE_STATUS_GOOD);
    }

    val sane_strstatus(int status) {
        return val(::sane_strstatus((SANE_Status) status));
    }

}

/*

Weird way to export enums as simple JS objects...

I tried using constant bindings to expose the enums, but could not make it
work. I don't think it's possible to create the val::object during static
initialization (int binding error?).

Using main() to map the enums at runtime, kind of weird?

XXX: help me

val enum_SANE_STATUS_to_val() {
    val obj = val::object();
    obj.set("GOOD", (int) SANE_STATUS_GOOD);
    // ...
    return obj;
}

EMSCRIPTEN_BINDINGS(sane_bindings) {
    constant("SANE_STATUS", enum_SANE_STATUS_to_val());
}

*/

EM_JS(void, module_set, (const char* k, EM_VAL v), {
    Module[UTF8ToString(k)] = Emval.toValue(v);
});

val map_to_val_object(const std::map<const char *, int> &map) {
    val obj = val::object();
    for (const auto &kv : map) {
        obj.set(kv.first, kv.second);
    }
    return obj;
}

int main() {
    module_set("SANE_STATUS", map_to_val_object(sane::SANE_STATUS).as_handle());
    module_set("SANE_TYPE", map_to_val_object(sane::SANE_TYPE).as_handle());
    module_set("SANE_UNIT", map_to_val_object(sane::SANE_UNIT).as_handle());
    module_set("SANE_CONSTRAINT", map_to_val_object(sane::SANE_CONSTRAINT).as_handle());
    module_set("SANE_FRAME", map_to_val_object(sane::SANE_FRAME).as_handle());
    return 0;
}

EMSCRIPTEN_BINDINGS(sane_bindings) {
    constant("SANE_WASM_COMMIT", val(SANE_WASM_COMMIT));
    constant("SANE_WASM_VERSION", val(SANE_WASM_VERSION));
    constant("SANE_CURRENT_MAJOR", SANE_CURRENT_MAJOR);
    constant("SANE_CURRENT_MINOR", SANE_CURRENT_MINOR);
    function("sane_get_state", &sane::sane_get_state);
    function("sane_init", &sane::sane_init);
    function("sane_exit", &sane::sane_exit);
    function("sane_get_devices", &sane::sane_get_devices);
    function("sane_open", &sane::sane_open);
    function("sane_close", &sane::sane_close);
    function("sane_get_option_descriptor", &sane::sane_get_option_descriptor);
    function("sane_control_option_get_value", &sane::sane_control_option_get_value);
    function("sane_control_option_set_value", &sane::sane_control_option_set_value);
    function("sane_control_option_set_auto", &sane::sane_control_option_set_auto);
    function("sane_get_parameters", &sane::sane_get_parameters);
    function("sane_start", &sane::sane_start);
    function("sane_read", &sane::sane_read);
    function("sane_cancel", &sane::sane_cancel);
    function("sane_strstatus", &sane::sane_strstatus);
}
