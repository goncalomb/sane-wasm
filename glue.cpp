#include <emscripten/bind.h>
#include <sane/sane.h>
#include <string>

using namespace emscripten;

SANE_Int version = 0;

namespace sane {

    int sane_init() {
        if (!version) {
            ::sane_init(&version, NULL);
        }
        return version;
    }

}

EMSCRIPTEN_BINDINGS(sane_bindings) {
    function("sane_init", &sane::sane_init);
}
