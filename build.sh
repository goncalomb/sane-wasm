#!/usr/bin/env bash

# SANE WebAssembly (sane-wasm)
# Copyright (C) 2023 Gonçalo MB <me@goncalomb.com>
# GNU GPLv2 + GNU LGPLv2.1

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

    # MAGIC to make docker build work with submodules.
    # This is only required if sane-wasm itself is being used as a submodule
    # not for a standalone build.
    # Don't ask me to explain this because I forgot how it works right after
    # typing the last command. Let's just say it uses some fake git configs
    # and many docker bind volume mounts. Please don't stare. @goncalomb
    # XXX: remove this madness when we have proper releases
    if [ -f .git ]; then
        echo "submodule build detected, magic activated"
        LOCAL_FAUX="$PWD/faux-git"
        DOCKER_FAUX="/tmp/faux-git"
        GIT_REL_P=$(sed "s/gitdir: //g" .git)
        GIT_ABS_P=$(realpath -- "$PWD/$GIT_REL_P")
        EXTRA_ARGS+=(-v "$GIT_ABS_P:$DOCKER_FAUX/git")
        while IFS= read -r ARG; do
            EXTRA_ARGS+=("$ARG")
        done < <({
            echo "."
            git submodule --quiet foreach --recursive pwd
        } | while IFS= read -r DIR; do (
            REL=$(realpath --relative-to "$PWD" -- "$DIR")
            TMP="$LOCAL_FAUX/$REL"
            echo "-v"
            echo "$LOCAL_FAUX/$REL/git:/src/$REL/.git"
            mkdir -p "$TMP"
            cd "$REL"
            GIT_REL=$(sed "s/gitdir: //g" .git)
            GIT_ABS=$(realpath -- "$PWD/$GIT_REL")
            cp "$GIT_REL/config" "$TMP/"
            GIT_DIR_REL=$(realpath --relative-to "$GIT_ABS_P" "$GIT_ABS")
            echo "gitdir: $DOCKER_FAUX/git/$GIT_DIR_REL" >"$TMP/git"
            cd "$TMP"
            git config --file config "core.worktree" "/src/$REL"
            echo "-v"
            echo "$LOCAL_FAUX/$REL/config:$DOCKER_FAUX/git/$GIT_DIR_REL/config"
        ) done)
    fi
    # MAGIC end

    docker run --rm -it -eSANE_WASM_DOCKER=1 \
        -v "$PWD:/src" \
        -u "$(id -u):$(id -g)" \
        "${EXTRA_ARGS[@]}" \
        sane-wasm:latest "$@"

    # MAGIC cleanup
    if [ -f .git ]; then
        rm -rf faux-git
    fi

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
rm -rf build
mkdir -p build

# The backends are selected automatically by reading SANE's .desc files and
# selecting the backends that support at least one USB device.
# http://www.sane-project.org/sane-backends.html
# Extra backends:
#   test: for testing
#   gphoto2,v4l: not enabled ATM, XXX: check compatibility and usefulness
# Excluded backends:
#   template,unsupported: not real backends
#   dell1600n_net: doesn't really support any USB device
#   genesys: causes lockup during sane_get_devices, XXX: to be fixed
SANE_WASM_BACKENDS=$(./utils.py usb-backends -i test -e template,unsupported,dell1600n_net,genesys)

SANE_WASM_COMMIT=$(git rev-parse HEAD)
SANE_WASM_VERSION=$(git describe --tags --always --dirty)
if [ -n "$ARG_debug" ]; then
    SANE_WASM_VERSION="$SANE_WASM_VERSION-debug"
fi
cat <<EOF >build/version.h
#define SANE_WASM_COMMIT "$SANE_WASM_COMMIT"
#define SANE_WASM_VERSION "$SANE_WASM_VERSION"
#define SANE_WASM_BACKENDS "$SANE_WASM_BACKENDS"
EOF

DEPS="$PWD/deps"
SANE="$DEPS/backends"
PREFIX="$PWD/build/prefix"
export EM_PKG_CONFIG_PATH=$PREFIX/lib/pkgconfig

# debug flags
D_O0G3=()
if [ -n "$ARG_debug" ]; then
    D_O0G3=("-O0" "-g3")
fi

# apply dependency patches
(
    cd deps
    find . -mindepth 1 -maxdepth 1 -type f -name "*.patch" -printf "%f\n" | while IFS= read -r PATCH; do
        echo "applying '$PATCH'"
        git -C "${PATCH%.patch}" apply "../$PATCH" || true # failing is expected on non-clean builds (patch already applied)
    done
)

# libjpeg-turbo
# https://github.com/libjpeg-turbo/libjpeg-turbo/issues/250
(
    cd deps/libjpeg-turbo
    export LDFLAGS="-sALLOW_MEMORY_GROWTH"
    [ -f Makefile ] || emcmake cmake -DWITH_SIMD=0 -DENABLE_SHARED=0 .
    emmake make -j jpeg-static
)

# libusb
# https://web.dev/porting-libusb-to-webusb/
# https://web.dev/porting-gphoto2-to-the-web/
# https://github.com/libusb/libusb/pull/1057
(
    cd deps/libusb
    [ -f configure ] || NOCONFIGURE=1 ./autogen.sh
    [ -f Makefile ] || emconfigure ./configure --prefix="$PREFIX" --host=wasm32-unknown-emscripten
    emmake make -j install
)

# backends
(
    cd deps/backends
    [ -f configure ] || ./autogen.sh
    export CPPFLAGS="-I$DEPS/libjpeg-turbo -Wno-error=incompatible-function-pointer-types"
    export LDFLAGS="-L$DEPS/libjpeg-turbo --bind -sASYNCIFY -sALLOW_MEMORY_GROWTH"
    export BACKENDS="$SANE_WASM_BACKENDS"
    # XXX: Force enable mmap, configure can't detect valid mmap, force it on!
    # I've looked briefly into this, it's probably emscripten's implementation
    # that is not complete, mmap appears to only be used by the pieusb backend
    # consider disabling it if this is problematic.
    [ -f Makefile ] || sed -i "s/ac_cv_func_mmap_fixed_mapped=no/ac_cv_func_mmap_fixed_mapped=yes/g" configure
    [ -f Makefile ] || emconfigure ./configure --prefix="$PREFIX" --host=wasm32 --enable-pthread --disable-shared
    # make only the required parts
    emmake make -j -C lib
    emmake make -j -C sanei
    emmake make -j -C backend install
)

# Truncate dll.conf, this file sets which backends are enabled, but because we
# are doing a static build without shared libraries we don't really need it
# (all backends are always enabled). Leaving other backends listed on that file
# causes SANE to try to dynamically load them, we don't need that.
: >"$PREFIX/etc/sane.d/dll.conf"

# Set test backend's number of devices to 0.
# XXX: Oops what? There is some kind of invalid memory access on the backend
#      file deps/backends/backend/test.c, setting number_of_devices to 0 causes
#      some weird behavior and it's as if 1 device was selected.
#      I've looked briefly into this, but was unable to find the cause,
#      it's somehow related to how the option is read with:
#      read_option (line, "number_of_devices", ...
#      and then used on a for loop:
#      for (num = 0; num < init_number_of_devices; num++)
#      that loop should never run with init_number_of_devices = 0.
#      I've tested this config on my linux distribution version of SANE and
#      it triggers a Segmentation Fault so there is definitely a problem there.
# XXX: Setting it to -999 for now, fix this, and revert this to 0.
#      The fix should probably be pushed upstream to SANE itself:
#      https://gitlab.com/sane-project/backends/-/issues
sed -i "s/^number_of_devices .*/number_of_devices -999/g" "$PREFIX/etc/sane.d/test.conf"

# build sane-wasm itself (with glue.cpp)
set -x
# XXX: -std=c++20 help?
"$SANE/libtool" --tag=CC --mode=link emcc \
    -std=c++20 \
    "-I$SANE/include" "$SANE/backend/.libs/libsane.la" "$SANE/sanei/.libs/libsanei.la" \
    glue.cpp -o build/libsane.html "${D_O0G3[@]}" \
    --bind -pthread -sASYNCIFY -sALLOW_MEMORY_GROWTH -sPTHREAD_POOL_SIZE=2 \
    --embed-file="$PREFIX/etc/sane.d@/etc/sane.d" \
    -sEXPORTED_RUNTIME_METHODS=FS \
    -sMODULARIZE -sEXPORT_NAME=LibSANE \
    --pre-js pre.js --post-js post.js --shell-file shell.html
set +x

# clean build directory on non-debug builds
if [ -z "$ARG_debug" ]; then
    rm -rf build/.libs build/prefix build/version.h
fi

post-build
