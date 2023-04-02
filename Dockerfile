FROM emscripten/emsdk:3.1.20

RUN apt update && apt install -y automake autoconf autoconf-archive autopoint libtool gettext pkg-config

COPY deps ./deps
COPY glue.cpp ./
COPY build.sh ./

# required for building using the host uid/gid
RUN chmod 0777 /src

ENTRYPOINT ["./build.sh"]
