#!/usr/bin/env python3

import argparse
import re
import os
import json

dir = os.path.realpath(os.path.dirname(__file__))
dir_desc = os.path.join(
    dir, 'deps', 'backends', 'doc', 'descriptions')
dir_desc_external = os.path.join(
    dir, 'deps', 'backends', 'doc', 'descriptions-external')


def read_desc(file):
    # value types by keyword (k: keyword, s1: string, s+: string array)
    spec_k = {
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

    # valid keyword values by keyword
    spec_kv = {
        ':status': [':minimal', ':basic', ':good', ':complete', ':untested', ':unsupported'],
        ':new': [':yes', ':no'],
        ':devicetype': [':scanner', ':stillcam', ':vidcam', ':api', ':meta'],
    }

    # file specification (1: required, ?: optional, *: optional array)
    # a dict marks a keyword that starts a new array element:
    #   _key: key on the parent object that contains the array
    #   _kwkey: key on the array object that contains the current value
    #   _groups: conditional parsing array, each element must be a dict that
    #       contains a special key _values, it selects the next level based on
    #       the value of the current keyword
    # arrays are closed when a keyword is not valid at that level
    spec_l = {
        'backend': '1',
        'version': '?',
        'new': '?',
        'manpage': '?',
        'url': '*',
        'comment': '?',
        'devicetype': {
            '_key': 'types',
            '_kwkey': 'type',
            '_groups': [{
                '_values': ['scanner', 'stillcam', 'vidcam'],
                'mfg': {
                    '_key': 'manufacturers',
                    '_kwkey': 'name',
                    'url': '*',
                    'comment': '?',
                    'model': {
                        '_key': 'devices',
                        '_kwkey': 'name',
                        'status': '1',
                        'interface': '?',
                        'scsi': '?',
                        'usbid': '?',
                        'url': '*',
                        'comment': '?',
                    },
                },
            }, {
                '_values': ['api', 'meta'],
                'desc': '1',
                'url': '+',
                'comment': '?',
            }],
        },
    }

    # PHASE 0: read and clean non-comment lines

    l = 1

    def read_lines():
        nonlocal l
        with open(file, 'r') as fp:
            for line in fp:
                line = line.strip()
                if line and line[0] != ';':
                    yield line
                l += 1

    def ex(msg):
        return Exception("%s, in file %s:%d" % (msg, os.path.basename(file), l))

    # PHASE 1: interpret keywords and values (spec_k and spec_kv)

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

    def read_lines_parsed():
        for line in read_lines():
            kw, rest = read_keyword(line)
            if kw not in spec_k:
                raise ex("unknown keyword")
            if not (rest := consume_spaces(rest)):
                ex("unexpected end of line")
            if spec_k[kw][0] == 'k':
                val, rest = read_keyword(rest)
                if (not val in spec_kv[kw]):
                    raise ex("unexpected keyword value")
                val = val[1:]
                expect_empty(rest)
            elif spec_k[kw][0] == 's':
                val, rest = read_string(rest)
                if spec_k[kw][1] == '+':
                    val = [val]
                    while rest := consume_spaces(rest):
                        s, rest = read_string(rest)
                        val.append(s)
                else:
                    expect_empty(rest)
            # XXX: out of spec, some comments have multiple strings, read as array and join
            if kw == ':comment':
                val = ' '.join(val)
            yield kw[1:], val

    # PHASE 2: process "tokenized" lines into final object (spec_l)

    level = spec_l
    level_stack = []
    data = {
        '_file': os.path.basename(file),
    }
    data_stack = []

    for kw, val in read_lines_parsed():
        # pop from stack if the keyword is not found at current level
        while kw not in level and level_stack:
            for k in level:
                if k[0] != '_' and level[k] == '1' and k not in data:
                    raise ex("missing required keyword '%s'" % k)
            level = level_stack.pop()
            data = data_stack.pop()

        if kw not in level:
            raise ex("unexpected keyword")

        if isinstance(level[kw], dict):
            # array declaration, push into the stack
            level_stack.append(level)
            data_stack.append(data)

            # prepare array and new data
            level = level[kw]
            if level['_key'] not in data:
                data[level['_key']] = []
            new_data = {
                level['_kwkey']: val
            }
            data[level['_key']].append(new_data)
            data = new_data

            # handle conditional "groups"
            if '_groups' in level:
                for level in level['_groups']:
                    if val in level['_values']:
                        break
        else:
            # read plain field values
            if kw in data:
                if level[kw] == '*':
                    data[kw].append(val)
                else:
                    raise ex("duplicate keyword")
            elif level[kw] == '*':
                data[kw] = [val]
            else:
                data[kw] = val

    # unwind stack while checking required fields
    while True:
        for k in level:
            if k[0] != '_' and level[k] == '1' and k not in data:
                raise ex("missing required keyword '%s'" % k)
        if not level_stack:
            break
        level = level_stack.pop()
        data = data_stack.pop()

    return data


def read_desc_devices(file, ctx=False):
    data = read_desc(file)
    if 'types' in data:
        for d_type in data['types']:
            if 'manufacturers' in d_type:
                for d_manufacturer in d_type['manufacturers']:
                    if 'devices' in d_manufacturer:
                        for d_device in d_manufacturer['devices']:
                            yield (d_device, d_manufacturer, d_type, data) if ctx else d_device


def command_dump_desc(args):
    lst = []
    for f in os.scandir(dir_desc):
        lst.append(read_desc(f))
    for f in os.scandir(dir_desc_external):
        lst.append(read_desc(f))
    print(json.dumps(lst, indent=2))


def command_dump_interfaces(args):
    interf = {}

    def dump_interf(file):
        nonlocal interf
        for dev in read_desc_devices(file):
            if 'interface' in dev:
                if dev['interface'] in interf:
                    interf[dev['interface']] += 1
                else:
                    interf[dev['interface']] = 1

    for f in os.scandir(dir_desc):
        dump_interf(f)
    for f in os.scandir(dir_desc_external):
        dump_interf(f)

    # XXX: use OrderedDict required?
    interf = dict(sorted(interf.items(), key=lambda x: x[1], reverse=True))
    print(json.dumps(interf, indent=2))


def command_usb_backends(args):
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
        yes = False
        for dev in read_desc_devices(f):
            if 'interface' in dev and dev['interface'].find('USB') != -1:
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
    parser_dump_interfaces = subparsers.add_parser(
        'dump-interfaces', description='')
    parser_dump_interfaces.set_defaults(fn=command_dump_interfaces)
    parser_usb_backends = subparsers.add_parser('usb-backends', description='')
    parser_usb_backends.add_argument(
        '-i', '--include', help='backends to include (extra)')
    parser_usb_backends.add_argument(
        '-e', '--exclude', help='backends to exclude')
    parser_usb_backends.set_defaults(fn=command_usb_backends)

    args = parser.parse_args()
    args.fn(args)
