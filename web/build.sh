#!/bin/sh

set -eu

unset LD_LIBRARY_PATH

start_dir="$( realpath "$( pwd )" )"
project_dir="$( realpath "$( dirname -- "$( realpath "$0" )" )" )"
core_dir="$( realpath "${project_dir}/../core" )"

"$core_dir"/build.sh
cd "$project_dir"

if [ ! -d node_modules ] || [ "${GIT_CHORD_FORCE_NPM_INSTALL:-}" = "1" ]; then
    npm install --no-audit --no-fund --legacy-peer-deps
fi
npm install --no-audit --no-fund --legacy-peer-deps ../core/package-dist/git-chord-gui-core-*.tgz
npm run build

cd "$start_dir"
