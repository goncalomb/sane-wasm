#!/bin/bash

set -eo pipefail
cd -- "$(dirname -- "$0")"

ARGS=("with-docker" "clean" "no-build" "debug" "emrun" "shell")
usage() {
    echo "usage: ${0##*/} [options]"
    echo "  --with-docker  run with docker (preferred)"
    echo "  --clean        clean 'deps' and 'build' directories"
    echo "  --no-build     don't actually build"
    echo "  --debug        enable debug flags"
    echo "  --emrun        run emrun development server"
    echo "  --shell        run debug shell (depends on --with-docker)"
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

# use docker
if [ -n "$ARG_with_docker" ] && [ -z "$SANE_WASM_DOCKER" ]; then
    docker build -t sane-wasm .
    EXTRA_ARGS=()
    if [ -n "$ARG_emrun" ]; then
        EXTRA_ARGS+=("-p6931:6931")
    fi
    docker run --rm -it -eSANE_WASM_DOCKER=1 \
        -v "$PWD:/src" \
        -u "$(id -u):$(id -g)" \
        "${EXTRA_ARGS[@]}" \
        sane-wasm:latest "$@"
    exit
fi

# clean
if [ -n "$ARG_clean" ]; then
    find deps -mindepth 1 -maxdepth 1 -type d | while IFS= read -r DIR; do
        echo "cleaning '$DIR'"
        git -C "$DIR" checkout .
        git -C "$DIR" clean -fdx
    done
    echo "removing 'build'"
    rm -rf build
fi

# post build actions
post-build() {
    if [ -n "$ARG_emrun" ]; then
        echo "running emrun"
        emrun --no_browser build/libsane.html
    fi
    if [ -n "$ARG_shell" ] && [ -n "$SANE_WASM_DOCKER" ] && [ -z "$SANE_WASM_SHELL" ]; then
        echo "running bash shell"
        SANE_WASM_SHELL=1 bash
    fi
}

# skip build
if [ -n "$ARG_no_build" ]; then
    post-build
    exit
fi

# build
DEPS="$PWD/deps"
PREFIX="$PWD/build/prefix"
export EM_PKG_CONFIG_PATH=$PREFIX/lib/pkgconfig

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

# TODO: review build commands and arguments, many build arguments may not be
#       ideal, specially libjpeg-turbo and backends

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
    export CPPFLAGS="-I$DEPS/libjpeg-turbo -Wno-error=incompatible-function-pointer-types"
    export LDFLAGS="-L$DEPS/libjpeg-turbo --bind -sASYNCIFY -sALLOW_MEMORY_GROWTH"
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
    -sMODULARIZE -sEXPORT_NAME=LibSANE --pre-js pre.js --shell-file shell.html
set +x

# clean build directory on non-debug builds
if [ -z "$ARG_debug" ]; then
    rm -rf build/.libs build/prefix
fi

post-build
