FROM emscripten/emsdk:3.1.48

RUN apt-get update && apt-get install -y automake autoconf autoconf-archive autopoint libtool gettext pkg-config

# emsdk:3.1.50 is not available yet, do some patching here
# TODO: remove this when emscripten/emsdk:3.1.50 is available on docker
# https://github.com/emscripten-core/emscripten/pull/20682
RUN curl -o \
    /emsdk/upstream/emscripten/cache/sysroot/include/emscripten/val.h \
    https://raw.githubusercontent.com/emscripten-core/emscripten/c017fc2d6961962ee87ae387462a099242dfbbd2/system/include/emscripten/val.h
RUN echo '\
extern "C" {\
  __attribute__((weak))\
  void _emval_coro_resume(emscripten::val::awaiter* awaiter, emscripten::EM_VAL result) {\
    awaiter->resume_with(emscripten::val::take_ownership(result));\
  }\
}\
' >>/emsdk/upstream/emscripten/cache/sysroot/include/emscripten/val.h

ENTRYPOINT ["./build.sh"]
