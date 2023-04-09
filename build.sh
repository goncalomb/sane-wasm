#!/bin/bash

set -e
cd -- "$(dirname -- "$0")"

ARGS=("with-docker" "debug")
usage() {
    echo "usage: ${0##*/} [options]"
    echo "  --with-docker  build using docker"
    echo "  --debug        enable debug"
}
for A in "${ARGS[@]}"; do
    declare "ARG_${A//-/_}="
done
for V in "$@"; do
    VV=${V#--}
    if [ "$V" == "--$VV" ] && [ -v "ARG_${VV//-/_}" ]; then
        declare "ARG_${VV//-/_}=1"
    else
        usage ; exit 1
    fi
done

mkdir -p build

if [ -n "$ARG_with_docker" ] && [ -z "$SANE_WASM_DOCKER" ]; then
    docker build . -t sane-wasm
    if [ -z "$ARG_debug" ]; then
        docker run --rm -it -eSANE_WASM_DOCKER=1 \
            -v "$(pwd)/build:/src/build" \
            sane-wasm:latest "$@"
    else
        docker run --rm -it -eSANE_WASM_DOCKER=1 \
            -p6931:6931 \
            -v "$(pwd)/build:/src/build" \
            -v "$(pwd)/deps/backends:/src/deps/backends" \
            -v "$(pwd)/deps/libjpeg-turbo:/src/deps/libjpeg-turbo" \
            -v "$(pwd)/deps/libusb:/src/deps/libusb" \
            -v "$(pwd)/.git/modules:/src/.git/modules:ro" \
            -v "$(pwd)/build.sh:/src/build.sh:ro" \
            -v "$(pwd)/glue.cpp:/src/glue.cpp:ro" \
            -v "$(pwd)/shell.html:/src/shell.html:ro" \
            -u "$(id -u):$(id -g)" \
            sane-wasm:latest "$@"
    fi
    exit
fi

export PREFIX="$(pwd)/prefix"
export EM_PKG_CONFIG_PATH=$PREFIX/lib/pkgconfig

if [ -z "$ARG_debug" ] && [ -n "$SANE_WASM_DOCKER" ] && [ -n "$SANE_WASM_DEBUG" ]; then
    echo "while debugging inside docker '${0##*/}' must be run with '--debug'"
    exit 1
fi

D_O0G3=()
if [ -n "$ARG_debug" ]; then
    D_O0G3=("-O0" "-g3")
fi

# apply dependency patches
(
    cd deps
    find . -mindepth 1 -maxdepth 1 -type f -name "*.patch" -printf "%f\n" | while IFS= read -r PATCH; do
        echo "applying '$PATCH'"
        git -C "${PATCH%.patch}" apply "../$PATCH" || true # failing is expected while in debug/local mode
    done
)

# https://github.com/libjpeg-turbo/libjpeg-turbo/issues/250
(
    cd deps/libjpeg-turbo
    export LDFLAGS="--emrun"
    [ -f Makefile ] || emcmake cmake -G"Unix Makefiles" \
            -DCMAKE_EXECUTABLE_SUFFIX=.html \
            -DWITH_SIMD=0 -DENABLE_SHARED=0 \
            -DCMAKE_C_FLAGS="-Wall -s ALLOW_MEMORY_GROWTH=1" .
    emmake make -j jpeg-static
)

# https://web.dev/porting-libusb-to-webusb/
(
    cd deps/libusb
    [ -f configure ] || NOCONFIGURE=1 ./autogen.sh
    [ -f Makefile ] || emconfigure ./configure --prefix="$PREFIX" --host=wasm32
    emmake make -j install
)

(
    cd deps/backends
    [ -f configure ] || ./autogen.sh
    export CPPFLAGS="-I/src/deps/libjpeg-turbo -Wno-error=incompatible-function-pointer-types"
    export LDFLAGS="-L/src/deps/libjpeg-turbo --bind -sASYNCIFY -sALLOW_MEMORY_GROWTH"
    [ -f Makefile ] || emconfigure ./configure --prefix="$PREFIX" --enable-pthread --disable-shared BACKENDS="test pixma"
    ( cd lib ; emmake make -j )
    ( cd sanei ; emmake make -j )
    ( cd backend ; emmake make -j install )
)

SANE_DIR=./deps/backends

set -x
$SANE_DIR/libtool --tag=CC --mode=link emcc \
    "$SANE_DIR/backend/.libs/libsane.la" "$SANE_DIR/sanei/.libs/libsanei.la" \
    -I$SANE_DIR/include glue.cpp -o build/libsane.html \
    --bind -sASYNCIFY -sALLOW_MEMORY_GROWTH -sPTHREAD_POOL_SIZE=1 -pthread "${D_O0G3[@]}" \
    -sMODULARIZE -sEXPORT_NAME=LibSANE --shell-file shell.html
set +x

# ./build.sh --debug && emrun --no_browser build/libsane.html

if [ -n "$ARG_debug" ] && [ -n "$SANE_WASM_DOCKER" ] && [ -z "$SANE_WASM_DEBUG" ]; then
    echo "spawning bash shell for debug"
    SANE_WASM_DEBUG=1 bash
fi
