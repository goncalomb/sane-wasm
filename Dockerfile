FROM emscripten/emsdk:3.1.20

RUN apt update && apt install -y automake autoconf autoconf-archive autopoint libtool gettext pkg-config

ENTRYPOINT ["./build.sh"]
