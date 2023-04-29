#!/usr/bin/env python3

import argparse
import re
import os

dir = os.path.realpath(os.path.dirname(__file__))
dir_desc = os.path.join(
    dir, 'deps', 'backends', 'doc', 'descriptions')
dir_desc_external = os.path.join(
    dir, 'deps', 'backends', 'doc', 'descriptions-external')


def read_desc(file):
    # TODO: we shall improve this .desc parser later to properly handle nested
    #       devices and manufacturers, see deps/backends/tools/sane-desc.c,
    #       right now it's enough to get the information we want

    l = 1
    spec = {
        ':backend': 's1',
        ':version': 's1',
        ':new': 'k',
        ':manpage': 's1',
        ':url': 's1',
        ':devicetype': 'k',
        ':desc': 's1',
        ':mfg': 's1',
        ':url': 's1',
        ':model': 's1',
        ':interface': 's1',
        ':usbid': 's+',
        ':scsi': 's+',
        ':comment': 's+',
        ':status': 'k',
    }

    def ex(msg):
        return Exception("%s, in file %s:%d" % (msg, os.path.basename(file), l))

    def read_keyword(txt: str):
        m = re.match(r'^(:[a-z]+)(.*)$', txt)
        if not m:
            raise ex("invalid keyword")
        return m[1], m[2]

    def read_string(txt: str):
        if txt[0] != '"':
            # raise ex("invalid string")
            # weird? unquoted string, read up to space
            if txt[0] == ':' or txt[0].isspace():
                raise ex("invalid string")
            i = 0
            while i < len(txt) and not txt[i].isspace():
                i += 1
            return txt[:i], txt[i:]
        i = 1
        while i < len(txt) and (txt[i] != '"' or txt[i-1] == '\\'):
            i += 1
        if i == len(txt):
            raise ex("unterminated string")
        return txt[1:i].replace('\\"', '"'), txt[i+1:]

    def consume_spaces(txt: str):
        i = 0
        while i < len(txt) and txt[i].isspace():
            i += 1
        if i == len(txt) or txt[i] == ';':
            return None
        # XXX: out of spec, some strings end with extra '"', ignore
        if i == len(txt) - 1 and txt[i] == '"':
            return None
        # XXX: out of spec, some strings start with double '"', remove
        if len(txt) - i > 2 and txt[i:i+2] == '""' and not txt[i+3].isspace():
            i += 2
        if i == 0:
            raise ex("expected space")
        return txt[i:]

    def expect_empty(txt: str):
        if consume_spaces(txt):
            raise ex("unexpected extra data")

    result = []
    with open(file.path, 'r') as fp:
        for line in fp:
            line = line.strip()
            if line and line[0] != ';':
                k, rest = read_keyword(line)
                if k not in spec:
                    raise ex("unknown keyword")
                if not (rest := consume_spaces(rest)):
                    ex("unexpected end of line")
                if spec[k][0] == 'k':
                    val, rest = read_keyword(rest)
                    expect_empty(rest)
                elif spec[k][0] == 's':
                    val, rest = read_string(rest)
                    if spec[k][1] == '+':
                        val = [val]
                        while rest := consume_spaces(rest):
                            s, rest = read_string(rest)
                            val.append(s)
                    else:
                        expect_empty(rest)
                # XXX: out of spec, some comments have multiple strings, read as array and join
                if k == ':comment':
                    val = ' '.join(val)
                result.append((k, val))
            l += 1
    return result


def command_dump_desc(args):
    for f in os.scandir(dir_desc):
        print(read_desc(f))
    for f in os.scandir(dir_desc_external):
        print(read_desc(f))


def usb_backends(args):
    include = args.include.split(',') if args.include else []
    exclude = args.exclude.split(',') if args.exclude else []
    lst = []
    for f in os.scandir(dir_desc):
        backend = os.path.splitext(f.name)[0]
        if backend in exclude:
            continue
        elif backend in include:
            lst.append(backend)
            continue
        desc = read_desc(f)
        yes = False
        for k, v in desc:
            if k == ':interface' and v.find('USB') != -1:
                yes = True
                break
        if yes:
            lst.append(backend)
    lst.sort()
    print(' '.join(lst))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(prog='util')

    subparsers = parser.add_subparsers(
        title='commands', dest='command', required=True)
    parser_dump_desc = subparsers.add_parser('dump-desc', description='')
    parser_dump_desc.set_defaults(fn=command_dump_desc)
    parser_usb_backends = subparsers.add_parser('usb-backends', description='')
    parser_usb_backends.add_argument(
        '-i', '--include', help='backends to include (extra)')
    parser_usb_backends.add_argument(
        '-e', '--exclude', help='backends to exclude')
    parser_usb_backends.set_defaults(fn=usb_backends)

    args = parser.parse_args()
    args.fn(args)
