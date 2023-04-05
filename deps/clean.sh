#!/bin/bash

set -e
cd -- "$(dirname -- "$0")"

find . -mindepth 1 -maxdepth 1 -type d -printf "%f\n" | while IFS= read -r DIR; do
    echo "cleaning '$DIR'"
    git -C "$DIR" checkout .
    git -C "$DIR" clean -fdx
done
