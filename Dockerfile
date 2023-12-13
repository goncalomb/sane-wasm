FROM emscripten/emsdk:3.1.50

RUN apt-get update && apt-get install -y automake autoconf autoconf-archive autopoint libtool gettext pkg-config

ENTRYPOINT ["./build.sh"]
