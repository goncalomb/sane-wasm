FROM emscripten/emsdk:6.0.12

RUN apt-get update && apt-get install -y automake autoconf autoconf-archive autopoint libtool gettext pkg-config

ENTRYPOINT ["./build.sh"]
