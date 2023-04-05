#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <sane/sane.h>
#include <string>

using namespace emscripten;

#define B_LEN 1024*1024

SANE_Int version = 0;
SANE_Handle h;
SANE_Byte b[B_LEN];

val build_response(SANE_Status error, val data) {
    val obj = val::object();
    obj.set("error", (int) error);
    obj.set("data", data);
    return obj;
}

val build_error(SANE_Status error) {
    return build_response(error, val::null());
}

#define RETURN_ON_ERROR(status) if (status != SANE_STATUS_GOOD) return build_error(status);

namespace sane {

    int sane_init() {
        if (!version) {
            ::sane_init(&version, NULL);
        }
        return version;
    }

    val sane_get_devices() {
        sane_init();
        const SANE_Device **devices;
        SANE_Status res = ::sane_get_devices(&devices, SANE_TRUE);
        RETURN_ON_ERROR(res);
        val data = val::array();
        for (int i = 0; devices[i]; i++) {
            data.call<void, std::string>("push", std::string(devices[0]->name));
        }
        return build_response(res, data);
    }

    val sane_start() {
        SANE_Status res;

        if (h) {
            printf("already open\n");
            return build_error(SANE_STATUS_UNSUPPORTED);
        }

        sane_init();

        const SANE_Device **devices;
        res = ::sane_get_devices(&devices, SANE_TRUE);
        RETURN_ON_ERROR(res);

        if (!devices[0]) {
            printf("no devices\n");
            return build_error(SANE_STATUS_UNSUPPORTED);
        }

        SANE_Parameters params;

        res = sane_open(devices[0]->name, &h);
        printf("sane_open %d\n", res);
        RETURN_ON_ERROR(res);

        res = sane_get_parameters(h, &params);
        printf("sane_get_parameters %d\n", res);
        RETURN_ON_ERROR(res);

        res = ::sane_start(h);
        printf("sane_start %d\n", res);
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

    val sane_read() {
        if (!h) {
            return build_error(SANE_STATUS_INVAL);
        }

        SANE_Int len;
        SANE_Status res = ::sane_read(h, b, B_LEN, &len);
        RETURN_ON_ERROR(res);

        val data = val::object();
        data.set("pointer", (int) (SANE_Byte *) b);
        data.set("length", len);
        return build_response(res, data);
    }

}

EMSCRIPTEN_BINDINGS(sane_bindings) {
    function("sane_init", &sane::sane_init);
    function("sane_get_devices", &sane::sane_get_devices);
    function("sane_start", &sane::sane_start);
    function("sane_read", &sane::sane_read);
}
