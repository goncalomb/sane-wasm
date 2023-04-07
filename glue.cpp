#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <sane/sane.h>
#include <string>

using namespace emscripten;

#define BUFFER_LEN 2*1024*1024

SANE_Int version = 0;
SANE_Handle handle = NULL;
SANE_Byte buffer[BUFFER_LEN];

val build_response(SANE_Status status, val data) {
    val obj = val::object();
    obj.set("status", (int) status);
    obj.set("data", data);
    return obj;
}

val build_error(SANE_Status status) {
    return build_response(status, val::null());
}

#define RETURN_ON_ERROR(status) if (status != SANE_STATUS_GOOD) return build_error(status);

namespace sane {

    val sane_get_state() { // sync
        val version_ = val::object();
        version_.set("code", version);
        version_.set("major", SANE_VERSION_MAJOR(version));
        version_.set("minor", SANE_VERSION_MINOR(version));
        version_.set("build", SANE_VERSION_BUILD(version));
        val state = val::object();
        state.set("initialized", !!version);
        state.set("version", version_);
        state.set("open", !!handle);
        return state;
    }

    int sane_init() { // sync
        if (!version) {
            ::sane_init(&version, NULL);
        }
        return version;
    }

    void sane_exit() {
        emscripten_sleep(0); // force async

        ::sane_exit();
        version = 0;
        handle = NULL;
    }

    val sane_get_devices() {
        emscripten_sleep(0); // force async

        const SANE_Device **devices;
        SANE_Status res = ::sane_get_devices(&devices, SANE_TRUE);
        RETURN_ON_ERROR(res);

        val data = val::array();
        for (int i = 0; devices[i]; i++) {
            val device = val::object();
            device.set("name", devices[i]->name);
            device.set("vendor", devices[i]->vendor);
            device.set("model", devices[i]->model);
            device.set("type", devices[i]->type);
            data.call<void>("push", device);
        }
        return build_response(res, data);
    }

    val sane_open(std::string devicename) {
        emscripten_sleep(0); // force async

        if (!version || handle) {
            return build_error(SANE_STATUS_INVAL);
        }

        SANE_Status res = ::sane_open(devicename.c_str(), &handle);
        RETURN_ON_ERROR(res);
        return build_response(res, val::null());
    }

    void sane_close() {
        emscripten_sleep(0); // force async

        if (handle) {
            ::sane_close(handle);
            handle = NULL;
        }
    }

    val sane_get_parameters() { // sync
        if (!handle) {
            return build_error(SANE_STATUS_INVAL);
        }

        SANE_Parameters params;
        SANE_Status res = ::sane_get_parameters(handle, &params);
        RETURN_ON_ERROR(res);

        val data = val::object();
        data.set("format", (int) params.format);
        data.set("last_frame", (bool) params.last_frame);
        data.set("bytes_per_line", params.bytes_per_line);
        data.set("pixels_per_line", params.pixels_per_line);
        data.set("lines", params.lines);
        data.set("depth", params.depth);
        return build_response(res, data);
    }

    val sane_start() { // sync
        if (!handle) {
            return build_error(SANE_STATUS_INVAL);
        }

        SANE_Status res = ::sane_start(handle);
        RETURN_ON_ERROR(res);
        return build_response(res, val::null());
    }

    EM_JS(EM_VAL, sane_read_build_uint8_array, (int pointer, int length), {
        return Emval.toHandle(HEAPU8.subarray(pointer, pointer + length));
    });

    val sane_read() { // sync
        if (!handle) {
            return build_error(SANE_STATUS_INVAL);
        }

        SANE_Int len = 0;
        SANE_Status res = ::sane_read(handle, buffer, BUFFER_LEN, &len);
        val data = val::object();
        data.set("length", len);
        data.set("data", sane_read_build_uint8_array((int) (SANE_Byte *) buffer, len));
        return build_response(res, data);
    }

    val sane_cancel() { // sync
        if (!handle) {
            return build_error(SANE_STATUS_INVAL);
        }

        ::sane_cancel(handle);
        return build_response(SANE_STATUS_GOOD, val::null());
    }

    val sane_strstatus(int status) { // sync
        return val::u8string(::sane_strstatus((SANE_Status) status));
    }

}

EMSCRIPTEN_BINDINGS(sane_bindings) {
    function("sane_get_state", &sane::sane_get_state);
    function("sane_init", &sane::sane_init);
    function("sane_exit", &sane::sane_exit);
    function("sane_get_devices", &sane::sane_get_devices);
    function("sane_open", &sane::sane_open);
    function("sane_close", &sane::sane_close);
    function("sane_get_parameters", &sane::sane_get_parameters);
    function("sane_start", &sane::sane_start);
    function("sane_read", &sane::sane_read);
    function("sane_cancel", &sane::sane_cancel);
    function("sane_strstatus", &sane::sane_strstatus);
}
